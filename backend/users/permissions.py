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
