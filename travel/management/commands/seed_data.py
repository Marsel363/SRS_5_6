import json
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from travel.models import Country,Tour
class Command(BaseCommand):
    help='Загрузить начальный каталог без удаления заявок и избранного'
    @transaction.atomic
    def handle(self,*args,**options):
        data=json.loads((Path(__file__).resolve().parents[2]/'data'/'catalog.json').read_text(encoding='utf-8'))
        for item in data:
            country,_=Country.objects.update_or_create(slug=item['country_slug'],defaults={'name':item['country'],'description':item['country_description']})
            values={k:v for k,v in item.items() if not k.startswith('country')}
            title=values.pop('title')
            Tour.objects.update_or_create(title=title,defaults={'country':country,**values})
        self.stdout.write(self.style.SUCCESS(f'Готово: {Country.objects.count()} стран, {Tour.objects.count()} туров.'))
