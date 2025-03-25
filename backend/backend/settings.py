# backend/settings.py
from pathlib import Path
from datetime import timedelta
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# Configuración de medios
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Clave secreta y Debug
SECRET_KEY = os.environ.get('SECRET_KEY', '1234')
DEBUG = True  # En producción, recuerda poner DEBUG=False
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'corsheaders',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'users',  # Tu aplicación
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Configuración CORS
# Ajusta según tus dominios (local y producción)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "https://sis-propiell-yahirsolis17s-projects.vercel.app",
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "https://sis-propiell-yahirsolis17s-projects.vercel.app",
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'

# ------------------------------------------------------------------------------
# CONFIGURACIÓN DE LA BASE DE DATOS
# Usa variables de entorno para DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT.
# En Render, define estas variables de entorno con los datos que te proporciona Railway.
# Ejemplo:
#   DB_NAME = railway
#   DB_USER = root
#   DB_PASSWORD = KMQqSQMXpwsFVdchaSyyYMyHjApNDvAj
#   DB_HOST = interchange.proxy.rlwy.net
#   DB_PORT = 19331
# ------------------------------------------------------------------------------
# settings.py (Django en Render)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('MYSQLDATABASE', 'railway'),
        'USER': os.getenv('MYSQLUSER', 'root'),
        'PASSWORD': os.getenv('MYSQLPASSWORD', 'KWQqSQWXpwsFVdchaSyyYMyHjApNDvAj'),
        'HOST': os.getenv('MYSQLHOST', 'containers-us-west-146.railway.app'),  # <-- ¡Host público!
        'PORT': os.getenv('MYSQLPORT', '3366'),
        'OPTIONS': {
            'charset': 'utf8mb4',
            'ssl': {}  # Si Railway lo requiere, usa 'ssl': {'ca': '/ruta/a/cert.pem'}
        }
    }
}

AUTH_USER_MODEL = 'users.User'

LANGUAGE_CODE = 'es-es'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Configuración de Django REST Framework y SimpleJWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}
