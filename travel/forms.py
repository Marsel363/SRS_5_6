from django import forms
from django.utils import timezone
from datetime import timedelta
from .models import Booking
class BookingForm(forms.ModelForm):
    consent=forms.BooleanField(required=True)
    class Meta:
        model=Booking
        fields=['tour','name','email','departure','travelers']
    def clean_name(self):
        value=self.cleaned_data['name'].strip()
        if len(value)<2: raise forms.ValidationError('Укажите имя не короче двух символов.')
        return value
    def clean_departure(self):
        value=self.cleaned_data['departure']
        today=timezone.localdate()
        if not today<=value<=today+timedelta(days=730):
            raise forms.ValidationError('Выберите дату от сегодняшнего дня до двух лет вперёд.')
        return value
