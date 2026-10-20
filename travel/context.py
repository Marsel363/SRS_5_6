def navigation(request):
    from .models import Favorite
    return {'favorite_count': Favorite.objects.filter(owner=request.session.session_key).count() if request.session.session_key else 0}
