import logging

from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


def _admin_emails():
    emails = list(
        User.objects.filter(is_superuser=True, is_active=True)
        .exclude(email='')
        .values_list('email', flat=True)
    )
    extra = getattr(settings, 'ADMIN_ORDER_EMAIL', '')
    if extra and extra not in emails:
        emails.append(extra)
    return emails


def send_order_status_email(order, subject, body):
    if not order.user.email:
        return
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.user.email],
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to send order email to user %s', order.user_id)


def notify_admin_new_payment(order):
    admins = _admin_emails()
    if not admins:
        return
    body = (
        f'New payment uploaded for order {order.order_number}.\n\n'
        f'Customer: {order.first_name} {order.last_name}\n'
        f'Phone: {order.phone}\n'
        f'Amount: ₹{order.total_amount}\n'
        f'Status: {order.status_label}\n\n'
        f'Review in staff panel: /staff/orders/\n'
    )
    try:
        send_mail(
            subject=f'[DWH] New payment — {order.order_number}',
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=admins,
            fail_silently=False,
        )
    except Exception:
        logger.exception('Failed to notify admin for order %s', order.order_number)


def email_user_awaiting_confirmation(order):
    send_order_status_email(
        order,
        f'Payment received — {order.order_number}',
        (
            f'Hi {order.first_name},\n\n'
            f'We received your payment proof for order {order.order_number}.\n'
            f'Status: Waiting for owner confirmation.\n\n'
            f'We will email you once your order is confirmed or if we need more details.\n\n'
            f'— Divine Watch House'
        ),
    )


def email_user_confirmed(order):
    send_order_status_email(
        order,
        f'Order confirmed — {order.order_number}',
        (
            f'Hi {order.first_name},\n\n'
            f'Great news! Your order {order.order_number} has been CONFIRMED.\n'
            f'We will process shipping to your address shortly.\n\n'
            f'— Divine Watch House'
        ),
    )


def email_user_rejected(order):
    note = f'\nNote: {order.admin_note}\n' if order.admin_note else ''
    send_order_status_email(
        order,
        f'Order update — {order.order_number}',
        (
            f'Hi {order.first_name},\n\n'
            f'Unfortunately your order {order.order_number} could not be confirmed at this time.'
            f'{note}\n'
            f'Please contact us on WhatsApp if you have questions.\n\n'
            f'— Divine Watch House'
        ),
    )
