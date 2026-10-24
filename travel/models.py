from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Q


class Country(models.Model):
    name = models.CharField('Название', max_length=80, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField('Описание')

    class Meta:
        verbose_name = 'Страна'
        verbose_name_plural = 'Страны'

    def __str__(self):
        return self.name


class Tour(models.Model):
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name='tours')
    title = models.CharField('Название', max_length=160)
    category = models.CharField(
        'Тип',
        max_length=20,
        choices=[
            ('safari', 'Сафари'),
            ('beach', 'Пляж'),
            ('culture', 'Культура'),
        ],
    )
    description = models.TextField('Программа')
    duration = models.PositiveSmallIntegerField('Дней', validators=[MinValueValidator(1)])
    price = models.PositiveIntegerField('Цена за человека', validators=[MinValueValidator(1)])
    image = models.CharField('Изображение в static', max_length=200)
    included = models.TextField('Включено в стоимость')
    source_url = models.URLField('Источник о направлении')

    class Meta:
        verbose_name = 'Тур'
        verbose_name_plural = 'Туры'
        constraints = [
            models.CheckConstraint(condition=Q(price__gt=0), name='tour_positive_price'),
            models.CheckConstraint(condition=Q(duration__gt=0), name='tour_positive_duration')
        ]

    def __str__(self):
        return self.title


class Favorite(models.Model):
    owner = models.CharField(max_length=32, db_index=True)
    tour = models.ForeignKey(Tour, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'tour'], name='unique_favorite')]


class Booking(models.Model):
    owner = models.CharField(max_length=32, db_index=True)
    tour = models.ForeignKey(Tour, on_delete=models.PROTECT)
    name = models.CharField('Имя', max_length=80)
    email = models.EmailField('Email')
    departure = models.DateField('Дата поездки')
    travelers = models.PositiveSmallIntegerField(
        'Туристов', validators=[MinValueValidator(1), MaxValueValidator(10)])
    total = models.PositiveIntegerField('Стоимость')
    status = models.CharField(
        'Статус',
        max_length=20,
        default='new',
        choices=[
            ('new', 'Новая'),
            ('cancelled', 'Отменена'),
        ],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заявка'
        verbose_name_plural = 'Заявки'
        constraints = [
            models.CheckConstraint(condition=Q(
                travelers__gte=1, travelers__lte=10), name='booking_travelers_range'),
            models.CheckConstraint(condition=Q(total__gt=0), name='booking_positive_total')
        ]
