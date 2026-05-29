import uuid
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.contrib.auth.models import User

class Product(models.Model):
    brand = models.CharField(max_length=100, default='HMT')
    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_bestseller = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    def get_image_urls(self):
        urls = []
        if self.image:
            urls.append(self.image.url)
        for gallery_image in self.gallery_images.all():
            if gallery_image.image and gallery_image.image.url not in urls:
                urls.append(gallery_image.image.url)
        return urls

class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        related_name='gallery_images',
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to='products/gallery/')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Image for {self.product.name}"

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=20)
    flat_no = models.CharField(max_length=120)
    area = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    pincode = models.CharField(max_length=12)
    landmark = models.CharField(max_length=200, blank=True)
    country = models.CharField(max_length=80, default='India')
    updated_at = models.DateTimeField(auto_now=True)

class StoreOrder(models.Model):
   
    PAYMENT_TYPE_CHOICES = [
        ('full', 'Full Payment'),
        ('half', 'Half Advance Payment'),
    ]
    
    STATUS_CHOICES = [
        ('awaiting_confirmation', 'Awaiting Confirmation'),
        ('confirmed', 'Confirmed'),
        ('shipped', 'Shipped'),      # NEW
        ('delivered', 'Delivered'),  # NEW
        ('rejected', 'Rejected'),
    ]

    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPE_CHOICES, default='full')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='store_orders')
    order_number = models.CharField(max_length=20, unique=True, blank=True)
    items = models.JSONField(default=list)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=20)
    flat_no = models.CharField(max_length=120)
    area = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    pincode = models.CharField(max_length=12)
    landmark = models.CharField(max_length=200, blank=True)
    country = models.CharField(max_length=80, default='India')

    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='awaiting_confirmation')
    payment_proof = models.FileField(upload_to='payments/', blank=True, null=True, validators=[FileExtensionValidator(allowed_extensions=['pdf'])])
    admin_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = f'DWH-{uuid.uuid4().hex[:8].upper()}'
        super().save(*args, **kwargs)

    @property
    def status_label(self):
        return dict(self.STATUS_CHOICES).get(self.status, self.status)

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    order = models.ForeignKey(StoreOrder, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    for_admin = models.BooleanField(default=False)
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        target = 'Admin' if self.for_admin else (self.user.username if self.user else 'System')
        return f'{target}: {self.message[:40]}'

class Order(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    product_name = models.CharField(max_length=150)
    quantity = models.IntegerField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, default='Pending')

    def __str__(self):
        return f'Order {self.id} by {self.user.username}'

class WishlistItem(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='wishlist')
    product_name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image_url = models.CharField(max_length=255)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.product_name} - {self.user.username}"

class CartItem(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, related_name='cart')
    product_name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image_url = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.quantity}x {self.product_name} - {self.user.username}"