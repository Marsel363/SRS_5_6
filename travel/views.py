from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from .models import Country, Tour, Favorite, Booking
from .forms import BookingForm
import re


def owner(request):
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


def favorite_ids(request):
    return set(Favorite.objects.filter(owner=owner(request)).values_list('tour_id', flat=True))


@ensure_csrf_cookie
def home(request):
    return render(request, 'travel/home.html', {
        'tours': Tour.objects.select_related('country')[:3],
        'favorite_ids': favorite_ids(request)
    })


@ensure_csrf_cookie
def catalog(request):
    return render(request, 'travel/catalog.html')


@ensure_csrf_cookie
def detail(request, pk):
    return render(request, 'travel/detail.html', {
        'tour': get_object_or_404(Tour.objects.select_related('country'), pk=pk),
        'favorite_ids': favorite_ids(request)
    })


@ensure_csrf_cookie
def favorites(request):
    ids = favorite_ids(request)
    return render(request, 'travel/favorites.html', {'tours': Tour.objects.select_related('country').filter(id__in=ids), 'favorite_ids': ids})


@ensure_csrf_cookie
def bookings(request):
    return render(request, 'travel/bookings.html', {'bookings': Booking.objects.select_related('tour').filter(owner=owner(request))})


def about(request):
    return render(request, 'travel/about.html')


@require_GET
def api_tours(request):
    qs = Tour.objects.select_related('country').all()
    query = request.GET.get('q', '').strip()[:100]
    if query:
        # SQLite LIKE ignores case only for ASCII; iregex also handles Cyrillic.
        pattern = re.escape(query)
        qs = qs.filter(Q(title__iregex=pattern) | Q(
            country__name__iregex=pattern) | Q(description__iregex=pattern))
    country = request.GET.get('country', '')
    if country:
        qs = qs.filter(country__slug=country)
    category = request.GET.get('category', '')
    if category:
        qs = qs.filter(category=category)
    max_price = request.GET.get('max_price', '')
    if max_price:
        try:
            value = int(max_price)
        except (ValueError, TypeError):
            return JsonResponse({'error': 'Бюджет должен быть числом.'}, status=400)
        if value < 0:
            return JsonResponse({'error': 'Бюджет не может быть отрицательным.'}, status=400)
        qs = qs.filter(price__lte=value)
    order = {
        'price': 'price',
        '-price': '-price',
        'duration': 'duration',
        'title': 'title'
    }.get(request.GET.get('sort'), 'title')
    qs = qs.order_by(order)
    html = render_to_string('travel/partials/tour_grid.html',
                            {'tours': qs, 'favorite_ids': favorite_ids(request)}, request=request)
    return JsonResponse({'html': html, 'count': qs.count()})


@require_POST
def api_favorite(request, pk):
    tour = get_object_or_404(Tour, pk=pk)
    key = owner(request)
    desired = request.POST.get('active')
    if desired not in ('0', '1'):
        return JsonResponse({'error': 'Укажите active 0 или 1.'}, status=400)
    if desired == '1':
        Favorite.objects.get_or_create(owner=key, tour=tour)
    else:
        Favorite.objects.filter(owner=key, tour=tour).delete()
    return JsonResponse({'active': desired == '1', 'count': Favorite.objects.filter(owner=key).count()})


@require_POST
def api_quote(request):
    tour = get_object_or_404(Tour, pk=request.POST.get(
        'tour') if request.POST.get('tour', '').isdigit() else 0)
    try:
        travelers = int(request.POST.get('travelers', ''))
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Введите число туристов.'}, status=400)
    if not 1 <= travelers <= 10:
        return JsonResponse({'error': 'Допустимо от 1 до 10 туристов.'}, status=400)
    return JsonResponse({'total': tour.price * travelers, 'travelers': travelers})


@require_POST
def api_booking(request):
    form = BookingForm(request.POST)
    if not form.is_valid():
        return JsonResponse({'errors': form.errors.get_json_data()}, status=400)
    booking = form.save(commit=False)
    booking.owner = owner(request)
    booking.total = booking.tour.price * booking.travelers
    booking.save()
    return JsonResponse({
        'id': booking.id,
        'total': booking.total,
        'message': f'Заявка №{booking.id} создана. Вы можете найти её в разделе «Мои заявки».'
    }, status=201)


@require_POST
def api_cancel(request, pk):
    booking = get_object_or_404(Booking, pk=pk, owner=owner(request))
    booking.status = 'cancelled'
    booking.save(update_fields=['status'])
    return JsonResponse({'status': 'cancelled', 'label': booking.get_status_display()})
