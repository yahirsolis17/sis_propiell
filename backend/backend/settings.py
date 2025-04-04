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

# Configuración CORS (ajusta según tus dominios)
CORS_ALLOW_ALL_ORIGINS = True
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
# Configuración de la base de datos
# Se usan las variables de entorno para la conexión.
#
# En Render, define estas variables con los datos de Railway (utiliza la URL pública):
#   DB_NAME = railway
#   DB_USER = root
#   DB_PASSWORD = KMQqSQMXpwsFVdchaSyyYMyHjApNDvAj
#   DB_HOST = interchange.proxy.rlwy.net
#   DB_PORT = 19331
# ------------------------------------------------------------------------------
# Configuración de la base de datos usando variables de entorno con valores por defecto.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',  # Usamos mysqlclient (más común y probado)
        'NAME': os.getenv('DB_NAME', 'railway'),         # Nombre de la base de datos
        'USER': os.getenv('DB_USER', 'root'),            # Usuario
        'PASSWORD': os.getenv('DB_PASSWORD', 'KMQqSQMXpwsFVdchaSyyYMyHjApNDvAj'),  # Contraseña
        'HOST': os.getenv('DB_HOST', 'interchange.proxy.rlwy.net'),  # Host público de Railway
        'PORT': os.getenv('DB_PORT', '19331'),           # Puerto público de Railway
    }
}


AUTH_USER_MODEL = 'users.User'

LANGUAGE_CODE = 'es-es'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ------------------------------------------------------------------------------
# Configuración de Django REST Framework y SimpleJWT
# ------------------------------------------------------------------------------
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
