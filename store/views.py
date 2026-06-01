import json
import re
import os

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from django_ratelimit.decorators import ratelimit

from .models import Product

def staff_check(user):
    return user.is_authenticated and user.is_staff

def validate_password_strength(password: str) -> str | None:
    if len(password) < 8:
        return 'Password must be at least 8 characters.'
    if not re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter.'
    if not re.search(r'[0-9]', password):
        return 'Password must contain at least one number.'
    return None


def _parse_json_body(request) -> dict:
    try:
        return json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


@ensure_csrf_cookie
def index(request):
    if request.user.is_authenticated:
        return redirect('catalog')
    return render(request, 'index.html')


@ensure_csrf_cookie
def catalog(request):
    return render(request, 'catalog.html')


@require_GET
def check_auth(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'is_authenticated': True,
            'is_admin': request.user.is_superuser,
            'is_staff': request.user.is_staff,
            'email': request.user.email,
            'username': request.user.username,
        })
    return JsonResponse({'is_authenticated': False, 'is_admin': False, 'is_staff': False})


def logout_view(request):
    logout(request)
    return redirect('/')


@require_POST
@csrf_protect
@ratelimit(key='ip', rate='5/15m', method='POST', block=True)
def login_api(request):
    if getattr(request, 'limited', False):
        return JsonResponse({'message': 'Too many attempts. Try again later.'}, status=429)

    data = _parse_json_body(request)
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return JsonResponse({'message': 'Email and password are required.'}, status=400)

    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({'message': 'Invalid credentials.'}, status=401)

    try:
        user_obj = User.objects.get(email__iexact=email)
        user = authenticate(request, username=user_obj.username, password=password)
        if user is not None and user.is_active:
            login(request, user)
            return JsonResponse({'message': 'Logged in successfully'})
    except User.DoesNotExist:
        pass

    return JsonResponse({'message': 'Invalid credentials.'}, status=401)


@require_POST
@csrf_protect
@ratelimit(key='ip', rate='5/15m', method='POST', block=True)
def register_api(request):
    if request.method == 'POST':
        # 1. Parse JSON safely
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'message': 'Invalid data format'}, status=400)
            
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        # 2. STRICT BACKEND PASSWORD VALIDATION
        if len(password) < 8:
            return JsonResponse({'message': 'Password must be at least 8 characters long.'}, status=400)
        if not re.search(r'[A-Z]', password):
            return JsonResponse({'message': 'Password must contain at least one uppercase letter.'}, status=400)
        if not re.search(r'[a-z]', password):
            return JsonResponse({'message': 'Password must contain at least one lowercase letter.'}, status=400)
        if not re.search(r'[0-9]', password):
            return JsonResponse({'message': 'Password must contain at least one number.'}, status=400)

        # 3. Check for existing user safely (Django ORM prevents SQL Injection here)
        if User.objects.filter(email=email).exists():
            return JsonResponse({'message': 'Email already exists'}, status=400)

        # 4. Create User securely (Django automatically encrypts/hashes the password here)
        User.objects.create_user(username=username, email=email, password=password)
        return JsonResponse({'message': 'Registration successful'})
        
    return JsonResponse({'error': 'Invalid request'}, status=400)

@require_GET
@ratelimit(key='ip', rate='60/m', method='GET', block=True)
def get_products(request):
    if getattr(request, 'limited', False):
        return JsonResponse({'message': 'Too many requests.'}, status=429)

    products = Product.objects.prefetch_related('gallery_images').all()
    product_list = []
    for product in products:
        images = []
        for url in product.get_image_urls():
            if url.startswith('http'):
                images.append(url)
            else:
                images.append(request.build_absolute_uri(url))

        product_list.append({
            'id': product.id,
            'brand': product.brand,
            'name': product.name,
            'price': str(product.price),
            'is_bestseller': product.is_bestseller,
            'images': images,
            'image_url': images[0] if images else '',
        })
    return JsonResponse({'products': product_list})


@require_POST
@csrf_protect
@ratelimit(key='ip', rate='5/15m', method='POST', block=True)
def admin_login_api(request):
    if getattr(request, 'limited', False):
        return JsonResponse({'message': 'Too many attempts. Try again later.'}, status=429)

    data = _parse_json_body(request)
    email = (data.get('admin_email') or '').strip().lower()
    password = data.get('admin_password') or ''

    if not email or not password:
        return JsonResponse({'message': 'Admin email and password are required.'}, status=400)

    try:
        user_obj = User.objects.get(email__iexact=email)
        user = authenticate(request, username=user_obj.username, password=password)
        if user is not None and (user.is_superuser or user.is_staff) and user.is_active:
            login(request, user)
            return JsonResponse({'message': 'Admin logged in securely'})
    except User.DoesNotExist:
        pass

    return JsonResponse({'message': 'Invalid admin credentials.'}, status=401)

@user_passes_test(staff_check)
@require_POST
@csrf_protect
def admin_add_product(request):
    name = request.POST.get('name', '').strip()
    brand = request.POST.get('brand', 'HMT').strip()
    price = request.POST.get('price')
    is_bestseller = request.POST.get('is_bestseller') == 'true'
    image = request.FILES.get('image')

    if not name or not price:
        return JsonResponse({'message': 'Product name and price are required.'}, status=400)

    if image:
        ext = os.path.splitext(image.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
            return JsonResponse({'message': 'Only JPG, PNG, and WEBP images are allowed.'}, status=400)

    product = Product.objects.create(
        name=name,
        brand=brand,
        price=price,
        is_bestseller=is_bestseller,
        image=image
    )
    
    gallery_files = request.FILES.getlist('gallery_images')
    for f in gallery_files:
        ext = os.path.splitext(f.name)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.webp']:
            product.gallery_images.create(image=f)
            
    return JsonResponse({'message': 'Product added successfully!'})

@user_passes_test(staff_check)
@require_POST
@csrf_protect
def admin_delete_product(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
        product.delete()
        return JsonResponse({'message': 'Product deleted successfully!'})
    except Product.DoesNotExist:
        return JsonResponse({'message': 'Product not found.'}, status=404)

@user_passes_test(staff_check)
@require_POST
@csrf_protect
def admin_edit_product(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'message': 'Product not found.'}, status=404)

    name = request.POST.get('name', '').strip()
    brand = request.POST.get('brand', '').strip()
    price = request.POST.get('price')
    is_bestseller = request.POST.get('is_bestseller') == 'true'
    image = request.FILES.get('image')

    if not name or not price:
        return JsonResponse({'message': 'Product name and price are required.'}, status=400)

    if image:
        ext = os.path.splitext(image.name)[1].lower()
        if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
            return JsonResponse({'message': 'Only JPG, PNG, and WEBP images are allowed.'}, status=400)
        product.image = image

    product.name = name
    if brand:
        product.brand = brand
    product.price = price
    product.is_bestseller = is_bestseller
    product.save()

    gallery_files = request.FILES.getlist('gallery_images')
    for f in gallery_files:
        ext = os.path.splitext(f.name)[1].lower()
        if ext in ['.jpg', '.jpeg', '.png', '.webp']:
            product.gallery_images.create(image=f)

    return JsonResponse({'message': 'Product updated successfully!'})
