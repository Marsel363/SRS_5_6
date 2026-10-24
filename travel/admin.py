from django.contrib import admin
from .models import Country, Tour, Booking
admin.site.register(Country)


@admin.register(Tour)
class TourAdmin(admin.ModelAdmin):
    list_display = ['title', 'country', 'category', 'price', 'duration']
    list_filter = ['country', 'category']
    search_fields = ['title']


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'tour', 'departure', 'travelers', 'total', 'status']
    list_filter = ['status']
