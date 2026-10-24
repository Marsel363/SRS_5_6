from django.urls import path
from . import views
from . import explore_api
urlpatterns = [
    path('explore/', explore_api.explore, name='explore'),
    path('api/v1/tours/', explore_api.tour_list, name='explore_api_list'),
    path('api/v1/tours/<int:pk>/', explore_api.tour_detail, name='explore_api_detail'),
    path('', views.home, name='home'),
    path('tours/', views.catalog, name='catalog'),
    path('tours/<int:pk>/', views.detail, name='detail'),
    path('favorites/', views.favorites, name='favorites'),
    path('bookings/', views.bookings, name='bookings'),
    path('contacts/', views.about, name='about'),
    path('about/', views.about),
    path('api/tours/', views.api_tours, name='api_tours'),
    path('api/favorites/<int:pk>/', views.api_favorite, name='api_favorite'),
    path('api/quote/', views.api_quote, name='api_quote'),
    path('api/bookings/', views.api_booking, name='api_booking'),
    path('api/bookings/<int:pk>/cancel/', views.api_cancel, name='api_cancel')
]
