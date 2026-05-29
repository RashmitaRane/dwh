from django.contrib import admin
from .models import Product, ProductImage, UserProfile, StoreOrder, Notification, Order


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 2
    fields = ('image', 'order')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'brand', 'price', 'is_bestseller')
    search_fields = ('name', 'brand')
    list_filter = ('is_bestseller', 'brand')
    inlines = [ProductImageInline]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'first_name', 'phone', 'city', 'state')
    search_fields = ('user__username', 'user__email', 'phone', 'city')


@admin.register(StoreOrder)
class StoreOrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'user', 'total_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('order_number', 'user__email', 'phone', 'first_name')
    readonly_fields = ('order_number', 'created_at', 'updated_at')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('message', 'for_admin', 'user', 'is_read', 'created_at')
    list_filter = ('for_admin', 'is_read')


@admin.register(Order)
class LegacyOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'product_name', 'total_price', 'status')
