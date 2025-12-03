# backend/users/permissions.py
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """
    Permite acceso solo a usuarios con role ADMIN.
    """

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "ADMIN")


class IsRoleMatching(BasePermission):
    """
    Valida que el role del usuario coincida con el segment de la URL en DashboardView.

    e.g. /api/dashboard/dermatologo/ solo para user.role == "DERMATOLOGO"
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        role_param = view.kwargs.get("role", "").upper()
        return role_param == user.role

class IsAdminRole(BasePermission):
    """
    Permiso de compatibilidad para vistas antiguas.

    Se considera admin si:
    - es superusuario
    - o es staff
    - o tiene un atributo 'role' con valor tipo 'admin' / 'administrador' / 'superadmin'
    Ajusta la lógica según tus choices reales de rol.
    """
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Admin clásico de Django
        if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
            return True

        # Soportar esquemas con campo 'role'
        role = getattr(user, "role", None)
        if role is None:
            return False

        role_str = str(role).lower()
        return role_str in ("admin", "administrador", "superadmin")