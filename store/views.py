from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Product, Cart, CartItem

def index(request):
    # Safely fetch only bestsellers for the homepage
    bestsellers = Product.objects.filter(is_bestseller=True, stock__gt=0)[:4]
    return render(request, 'index.html', {'bestsellers': bestsellers})

def catalog(request):
    # Safely captures search query; Django ORM sanitizes this automatically
    query = request.GET.get('q', '')
    if query:
        products = Product.objects.filter(name__icontains=query, stock__gt=0)
    else:
        products = Product.objects.filter(stock__gt=0)
        
    return render(request, 'catalog.html', {'products': products, 'query': query})

@login_required(login_url='/login/')
def add_to_cart(request, product_id):
    if request.method == 'POST':
        product = get_object_or_404(Product, id=product_id)
        cart, created = Cart.objects.get_or_create(user=request.user)
        
        cart_item, item_created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not item_created:
            cart_item.quantity += 1
            cart_item.save()
            
    # Redirect back to the catalog page after adding
    return redirect('catalog')