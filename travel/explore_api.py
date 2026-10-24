import re

from django.db.models import Max, Min, Q
from django.http import HttpResponseRedirect, JsonResponse
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from .models import Country, Tour
from .views import favorite_ids

ORDERINGS = {"title", "price", "-price", "duration", "-duration"}
PAGE_SIZE = 3


def explore(request):
    """Сохранённые ссылки ведут в единый каталог с теми же параметрами."""
    query = request.META.get('QUERY_STRING', '')
    url = reverse('catalog')
    return HttpResponseRedirect(url + ('?' + query if query else ''))


def summary(tour):
    return {
        "id": tour.pk,
        "title": tour.title,
        "country": {"name": tour.country.name, "slug": tour.country.slug},
        "category": tour.category,
        "category_label": tour.get_category_display(),
        "duration": tour.duration,
        "price": tour.price,
        "image_url": static(tour.image),
    }


@require_GET
@never_cache
def tour_list(request):
    qs = Tour.objects.select_related("country")
    search = request.GET.get("search", "").strip()[:100]
    country = request.GET.get("country", "")
    category = request.GET.get("category", "")
    ordering = request.GET.get("ordering", "title")
    if ordering not in ORDERINGS:
        return JsonResponse({"error": "Неизвестный порядок сортировки."}, status=400)
    if category and category not in dict(Tour._meta.get_field("category").choices):
        return JsonResponse({"error": "Неизвестный тип отдыха."}, status=400)
    if search:
        pattern = re.escape(search)
        qs = qs.filter(Q(title__iregex=pattern) | Q(description__iregex=pattern)
                       | Q(country__name__iregex=pattern))
    if country:
        qs = qs.filter(country__slug=country)
    if category:
        qs = qs.filter(category=category)
    try:
        page = int(request.GET.get("page", "1"))
        if not 1 <= page <= 1_000_000:
            raise ValueError
        budget = request.GET.get("max_price", "")
        if budget:
            budget = int(budget)
            if not 0 <= budget <= 1_000_000_000:
                raise ValueError
            qs = qs.filter(price__lte=budget)
    except (ValueError, TypeError):
        return JsonResponse({"error": "Проверьте бюджет и номер страницы."}, status=400)

    totals = qs.aggregate(min_price=Min("price"), max_price=Max("price"))
    count = qs.count()
    pages = max(1, (count + PAGE_SIZE - 1) // PAGE_SIZE)
    page = min(page, pages)
    start = (page - 1) * PAGE_SIZE
    results = [summary(t) for t in qs.order_by(ordering, "pk")[start:start + PAGE_SIZE]]
    return JsonResponse({
        "count": count,
        "page": page,
        "pages": pages,
        "page_size": PAGE_SIZE,
        "results": results,
        "stats": totals,
        "filters": {
            "countries": list(Country.objects.order_by("name").values("name", "slug")),
            "categories": [{"value": value, "label": label} for value, label
                           in Tour._meta.get_field("category").choices],
        },
    })


@require_GET
@never_cache
def tour_detail(request, pk):
    tour = Tour.objects.select_related("country").filter(pk=pk).first()
    if tour is None:
        return JsonResponse({"error": "Этот тур больше не доступен. Обновите список."}, status=404)
    data = summary(tour)
    data.update({
        "description": tour.description,
        "country_description": tour.country.description,
        "included": tour.included,
        "source_url": tour.source_url,
        "booking_url": reverse("detail", args=[tour.pk]),
        "favorite": tour.pk in favorite_ids(request),
    })
    return JsonResponse(data)
