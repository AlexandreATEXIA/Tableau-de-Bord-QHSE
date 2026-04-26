@echo off
title Serveur SMI Dashboard Pro
color 0B

echo ===================================================
echo      LANCEMENT DU DASHBOARD QHSE EN COURS...
echo ===================================================
echo.
echo 1. Recherche du dossier du projet...
cd /d C:\Users\Utilisateur\Desktop\qhse-dashboard2

echo 2. Ouverture du navigateur dans 5 secondes...
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5175"

echo 3. Demarrage du moteur de l'application...
echo    (Le port peut varier : 5173, 5174, 5175... regardez la ligne "Local:" affichee ci-dessous)
npm run dev