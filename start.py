import importlib.util
import subprocess
import sys
import os
from pathlib import Path
os.chdir(Path(__file__).resolve().parent)


def run(*args):
    subprocess.run([sys.executable, *args], check=True)


if importlib.util.find_spec('django') is None:
    print('Установка Django.', flush=True)
    run('-m', 'pip', 'install', 'Django>=5.2.8,<5.3')
run('manage.py', 'migrate', '--noinput')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from travel.models import Tour
if not Tour.objects.exists():
    run('manage.py', 'seed_data')
print('СРС №6: http://127.0.0.1:8006/tours/ . Остановка: Ctrl+C', flush=True)
run('manage.py', 'runserver', '127.0.0.1:8006', '--noreload')
