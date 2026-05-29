import json
import io
from decimal import Decimal, InvalidOperation

import qrcode
from django.conf import settings
from django.contrib.auth.decorators import login_required, user_passes_test
from django.core.exceptions import ValidationError
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from django_ratelimit.decorators import ratelimit

from .emails import (
    email_user_awaiting_confirmation,
    email_user_confirmed,
    email_user_rejected,
    notify_admin_new_payment,
)
from .models import Notification, StoreOrder, UserProfile


def staff_check(user):
    return user.is_authenticated and user.is_staff


def _parse_json(request):
    try:
        return json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _profile_payload(profile):
    return {
        'first_name': profile.first_name,
        'last_name': profile.last_name,
        'email': profile.user.email,
        'phone': profile.phone,
        'flat_no': profile.flat_no,
        'area': profile.area,
        'city': profile.city,
        'state': profile.state,
        'district': profile.district,
        'pincode': profile.pincode,
        'landmark': profile.landmark,
        'country': profile.country,
    }


def _get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={'first_name': user.first_name or user.username},
    )
    return profile


def _order_payload(order, request):
    payment_url = ''
    if order.payment_proof:
        payment_url = request.build_absolute_uri(order.payment_proof.url)
    return {
        'id': order.id,
        'order_number': order.order_number,
        'items': order.items,
        'total_amount': str(order.total_amount),
        'status': order.status,
        'status_label': order.status_label,
        'address': {
            'first_name': order.first_name,
            'last_name': order.last_name,
            'phone': order.phone,
            'flat_no': order.flat_no,
            'area': order.area,
            'city': order.city,
            'state': order.state,
            'district': order.district,
            'pincode': order.pincode,
            'landmark': order.landmark,
            'country': order.country,
        },
        'payment_proof_url': payment_url,
        'admin_note': order.admin_note,
        'created_at': order.created_at.strftime('%d %b %Y, %I:%M %p'),
    }


@login_required(login_url='/catalog.html')
def checkout_page(request):
    return render(request, 'checkout.html')


@user_passes_test(staff_check)
def staff_orders_page(request):
    return render(request, 'staff_orders.html')


@login_required(login_url='/catalog.html')
@require_GET
def payment_qr_image(request):
    amount = request.GET.get('amount', '').strip()
    upi_id = getattr(settings, 'PAYMENT_UPI_ID', 'merchant@upi')
    upi_url = f'upi://pay?pa={upi_id}&pn=DivineWatchHouse&cu=INR'
    if amount:
        upi_url += f'&am={amount}'
    img = qrcode.make(upi_url)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return HttpResponse(buffer.getvalue(), content_type='image/png')


@login_required(login_url='/catalog.html')
@require_GET
def profile_api(request):
    profile = _get_or_create_profile(request.user)
    return JsonResponse(_profile_payload(profile))


@login_required(login_url='/catalog.html')
@require_POST
@csrf_protect
@ratelimit(key='user', rate='30/m', method='POST', block=True)
def profile_save_api(request):
    data = _parse_json(request)
    profile = _get_or_create_profile(request.user)
    fields = [
        'first_name', 'last_name', 'phone', 'flat_no', 'area',
        'city', 'state', 'district', 'pincode', 'landmark', 'country',
    ]
    for field in fields:
        if field in data:
            setattr(profile, field, str(data.get(field, '')).strip()[:200])
    profile.save()
    return JsonResponse({'message': 'Profile saved.', 'profile': _profile_payload(profile)})


@login_required(login_url='/catalog.html')
@require_POST
@csrf_protect
@ratelimit(key='user', rate='10/m', method='POST', block=True)
def submit_order_api(request):
    if getattr(request, 'limited', False):
        return JsonResponse({'message': 'Too many requests.'}, status=429)

    try:
        items = json.loads(request.POST.get('items', '[]'))
    except json.JSONDecodeError:
        return JsonResponse({'message': 'Invalid cart data.'}, status=400)

    if not items:
        return JsonResponse({'message': 'Your cart is empty.'}, status=400)

    payment_file = request.FILES.get('payment_proof')
    if not payment_file:
        return JsonResponse({'message': 'Please upload payment PDF.'}, status=400)

    if payment_file.size > 5 * 1024 * 1024:
        return JsonResponse({'message': 'PDF must be under 5 MB.'}, status=400)

    if not payment_file.name.lower().endswith('.pdf'):
        return JsonResponse({'message': 'Only PDF files are allowed.'}, status=400)

    profile = _get_or_create_profile(request.user)
    required = ['first_name', 'phone', 'flat_no', 'area', 'city', 'state', 'pincode']
    for field in required:
        if not getattr(profile, field, ''):
            return JsonResponse({'message': 'Please complete your delivery address.'}, status=400)

    try:
        total = Decimal('0')
        for item in items:
            price = Decimal(str(item.get('price', 0)))
            qty = int(item.get('quantity', 1))
            total += price * qty
    except (InvalidOperation, ValueError, TypeError):
        return JsonResponse({'message': 'Invalid cart totals.'}, status=400)

    order = StoreOrder.objects.create(
        user=request.user,
        items=items,
        total_amount=total,
        first_name=profile.first_name,
        last_name=profile.last_name,
        phone=profile.phone,
        flat_no=profile.flat_no,
        area=profile.area,
        city=profile.city,
        state=profile.state,
        district=profile.district,
        pincode=profile.pincode,
        landmark=profile.landmark,
        country=profile.country or 'India',
        status=StoreOrder.STATUS_AWAITING_CONFIRMATION,
        payment_proof=payment_file,
    )

    Notification.objects.create(
        user=request.user,
        order=order,
        message=f'Payment submitted for {order.order_number}. Waiting for owner confirmation.',
    )
    Notification.objects.create(
        user=None,
        order=order,
        for_admin=True,
        message=f'New payment uploaded — {order.order_number} (₹{order.total_amount}).',
    )

    try:
        email_user_awaiting_confirmation(order)
        notify_admin_new_payment(order)
    except Exception:
        pass

    return JsonResponse({
        'message': 'Payment submitted successfully.',
        'order': _order_payload(order, request),
    }, status=201)


@login_required(login_url='/catalog.html')
@require_GET
def user_orders_api(request):
    orders = StoreOrder.objects.filter(user=request.user)[:50]
    return JsonResponse({
        'orders': [_order_payload(o, request) for o in orders],
    })


@login_required(login_url='/catalog.html')
@require_GET
def user_notifications_api(request):
    notes = Notification.objects.filter(user=request.user, for_admin=False)[:30]
    return JsonResponse({
        'notifications': [
            {
                'id': n.id,
                'message': n.message,
                'is_read': n.is_read,
                'order_number': n.order.order_number if n.order else '',
                'created_at': n.created_at.strftime('%d %b %Y, %I:%M %p'),
            }
            for n in notes
        ],
        'unread_count': Notification.objects.filter(
            user=request.user, for_admin=False, is_read=False
        ).count(),
    })


@user_passes_test(staff_check)
@require_GET
def admin_orders_api(request):
    orders = StoreOrder.objects.select_related('user').all()[:100]
    return JsonResponse({
        'orders': [
            {
                **_order_payload(o, request),
                'customer_email': o.user.email,
                'customer_username': o.user.username,
            }
            for o in orders
        ],
    })


@user_passes_test(staff_check)
@require_GET
def admin_notifications_api(request):
    notes = Notification.objects.filter(for_admin=True).select_related('order')[:30]
    return JsonResponse({
        'notifications': [
            {
                'id': n.id,
                'message': n.message,
                'is_read': n.is_read,
                'order_number': n.order.order_number if n.order else '',
                'created_at': n.created_at.strftime('%d %b %Y, %I:%M %p'),
            }
            for n in notes
        ],
        'unread_count': Notification.objects.filter(for_admin=True, is_read=False).count(),
    })


@user_passes_test(staff_check)
@require_POST
@csrf_protect
def admin_order_confirm_api(request, order_id):
    try:
        order = StoreOrder.objects.get(pk=order_id)
    except StoreOrder.DoesNotExist:
        return JsonResponse({'message': 'Order not found.'}, status=404)

    if order.status == StoreOrder.STATUS_CONFIRMED:
        return JsonResponse({'message': 'Order already confirmed.'})

    order.status = StoreOrder.STATUS_CONFIRMED
    order.save(update_fields=['status', 'updated_at'])

    Notification.objects.create(
        user=order.user,
        order=order,
        message=f'Your order {order.order_number} has been CONFIRMED!',
    )
    Notification.objects.filter(for_admin=True, order=order, is_read=False).update(is_read=True)

    try:
        email_user_confirmed(order)
    except Exception:
        pass

    return JsonResponse({'message': 'Order confirmed.', 'order': _order_payload(order, request)})


@user_passes_test(staff_check)
@require_POST
@csrf_protect
def admin_order_reject_api(request, order_id):
    data = _parse_json(request)
    note = str(data.get('admin_note', '')).strip()[:500]

    try:
        order = StoreOrder.objects.get(pk=order_id)
    except StoreOrder.DoesNotExist:
        return JsonResponse({'message': 'Order not found.'}, status=404)

    order.status = StoreOrder.STATUS_REJECTED
    order.admin_note = note
    order.save(update_fields=['status', 'admin_note', 'updated_at'])

    Notification.objects.create(
        user=order.user,
        order=order,
        message=f'Your order {order.order_number} was rejected. Check your email for details.',
    )
    Notification.objects.filter(for_admin=True, order=order, is_read=False).update(is_read=True)

    try:
        email_user_rejected(order)
    except Exception:
        pass

    return JsonResponse({'message': 'Order rejected.', 'order': _order_payload(order, request)})

# In store/order_views.py

@user_passes_test(staff_check)
@require_POST
def admin_update_status_api(request, order_id):
    data = _parse_json(request)
    new_status = data.get('status') # 'shipped' or 'delivered'
    
    order = StoreOrder.objects.get(pk=order_id)
    order.status = new_status
    order.save()
    
    # Notify User via Notification Model
    Notification.objects.create(
        user=order.user,
        order=order,
        message=f"Your order {order.order_number} status is now: {order.status_label}"
    )
    return JsonResponse({'message': 'Status updated successfully'})

# In store/order_views.py

@user_passes_test(staff_check)
@require_POST
def admin_update_status_api(request, order_id):
    data = _parse_json(request)
    new_status = data.get('status') # 'shipped' or 'delivered'
    
    order = StoreOrder.objects.get(pk=order_id)
    order.status = new_status
    order.save()
    
    # Notify User via Notification Model
    Notification.objects.create(
        user=order.user,
        order=order,
        message=f"Your order {order.order_number} status is now: {order.status_label}"
    )
    return JsonResponse({'message': 'Status updated successfully'})