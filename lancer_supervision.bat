@echo off
title Serveur SMI Dashboard Pro
color 0B

echo ===================================================
echo      LANCEMENT DU DASHBOARD QHSE EN COURS...
echo ===================================================
echo.
echo 1. Recherche du dossier du projet...
cd C:\Users\Utilisateur\qhse-dashboard

echo 2. Ouverture du navigateur...
start http://localhost:5175

echo 3. Demarrage du moteur de l'application...
npm run dev