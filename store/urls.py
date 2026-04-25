from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('catalog/', views.catalog, name='catalog'),
    path('add-to-cart/<int:product_id>/', views.add_to_cart, name='add_to_cart'),
]