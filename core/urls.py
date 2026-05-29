from django.contrib import admin
from django.urls import path
from django.views.generic.base import RedirectView
from store import views
from store import order_views

urlpatterns = [
    # Native Django Admin
    path('admin/', admin.site.urls),
    
    # Redirect frontend /admin-dashboard/ to the real /admin/
    path('admin-dashboard/', RedirectView.as_view(url='/admin/', permanent=False)),
    
    # HTML Pages
    path('logout/', views.logout_view, name='logout'),
    path('', views.index, name='index'),
    path('catalog.html', views.catalog, name='catalog'),
    path('checkout/', order_views.checkout_page, name='checkout'),
    path('staff/orders/', order_views.staff_orders_page, name='staff_orders'),

    # JSON API Routes
    path('api/check-auth/', views.check_auth, name='check_auth'),
    path('api/login/', views.login_api, name='login_api'),
    path('api/register/', views.register_api, name='register_api'),
    path('api/products/', views.get_products, name='get_products'),
    
    # NEW: Custom Admin Login API
    path('api/admin-login/', views.admin_login_api, name='admin_login_api'),

    # Profile & checkout
    path('api/profile/', order_views.profile_api, name='profile_api'),
    path('api/profile/save/', order_views.profile_save_api, name='profile_save_api'),
    path('api/payment-qr/', order_views.payment_qr_image, name='payment_qr'),
    path('api/orders/submit/', order_views.submit_order_api, name='submit_order'),
    path('api/orders/', order_views.user_orders_api, name='user_orders'),
    path('api/notifications/', order_views.user_notifications_api, name='user_notifications'),

    # Staff
    path('api/staff/orders/', order_views.admin_orders_api, name='admin_orders'),
    path('api/staff/notifications/', order_views.admin_notifications_api, name='admin_notifications'),
    path('api/staff/orders/<int:order_id>/confirm/', order_views.admin_order_confirm_api, name='admin_order_confirm'),
    path('api/staff/orders/<int:order_id>/reject/', order_views.admin_order_reject_api, name='admin_order_reject'),
]
from django.conf import settings
from django.conf.urls.static import static


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)