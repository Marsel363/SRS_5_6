from django.urls import path
from . import views
urlpatterns=[
path('',views.home,name='home'),path('tours/',views.catalog,name='catalog'),
path('tours/<int:pk>/',views.detail,name='detail'),path('favorites/',views.favorites,name='favorites'),
path('bookings/',views.bookings,name='bookings'),path('contacts/',views.about,name='about'),path('about/',views.about),
path('api/tours/',views.api_tours,name='api_tours'),
path('api/favorites/<int:pk>/',views.api_favorite,name='api_favorite'),
path('api/quote/',views.api_quote,name='api_quote'),path('api/bookings/',views.api_booking,name='api_booking'),
path('api/bookings/<int:pk>/cancel/',views.api_cancel,name='api_cancel')]
