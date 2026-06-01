import os
import django
import json
import requests
from io import BytesIO

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth.models import User
from store.models import UserProfile

user, created = User.objects.get_or_create(
    username='testuser1',
    defaults={'email': 'testuser1@example.com'}
)
if created:
    user.set_password('Test1234')
    user.save()

profile, created = UserProfile.objects.get_or_create(
    user=user,
    defaults={
        'first_name': 'Test',
        'last_name': 'User',
        'phone': '9999999999',
        'flat_no': '123',
        'area': 'Test Area',
        'city': 'Bangalore',
        'state': 'Karnataka',
        'district': 'Bengaluru Urban',
        'pincode': '560001',
        'landmark': 'Near Test',
        'country': 'India',
    }
)
profile.phone = '9999999999'
profile.flat_no = '123'
profile.area = 'Test Area'
profile.city = 'Bangalore'
profile.state = 'Karnataka'
profile.district = 'Bengaluru Urban'
profile.pincode = '560001'
profile.save()

s = requests.Session()
_ = s.get('http://127.0.0.1:8000/catalog.html')
login_headers = {'X-CSRFToken': s.cookies.get('csrftoken', '')}
login = s.post('http://127.0.0.1:8000/api/login/', json={'email': 'testuser1@example.com', 'password': 'Test1234'}, headers=login_headers)
print('login', login.status_code, login.text)
headers = {'X-CSRFToken': s.cookies.get('csrftoken', '')}
print('csrf', headers['X-CSRFToken'])

items = [{'name': 'Test Watch', 'price': '3000', 'quantity': 2, 'image': 'http://example.com/watch.png'}]
body = {'items': json.dumps(items), 'payment_type': 'half'}
png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0bIDAT\x08\xd7c\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xcd\x18\x89\x00\x00\x00\x00IEND\xaeB`\x82'
files = {'payment_proof': ('proof.png', BytesIO(png), 'image/png')}
res = s.post('http://127.0.0.1:8000/api/orders/submit/', headers=headers, data=body, files=files)
print('submit', res.status_code, res.headers.get('content-type'))
with open('submit_response.html', 'wb') as f:
    f.write(res.content)
print('saved response to submit_response.html')
