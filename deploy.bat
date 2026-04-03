@echo off
setlocal

echo 1. Dang luu code len Git...
git add .
git commit -m "update"
git push

echo.
echo 2. Dang cap nhat FRONTEND len Firebase Hosting...
firebase deploy --only hosting --project xledu-dea6a

echo.
echo FRONTEND da deploy len Firebase Hosting.
echo BACKEND Node/Express can deploy rieng tren VPS, Render, Railway, Cloud Run hoac server ban dang dung.

echo.
echo XONG!pause
