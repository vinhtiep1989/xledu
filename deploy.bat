@echo off
echo 1. Dang cap nhat code moi nhat tu GitHub...
git pull origin main

echo 2. Dang luu code moi len Git...
git add .
git commit -m "update"
git push

echo.
echo 3. Dang cap nhat web len Firebase...
firebase deploy --project xledu-dea6a

echo.
echo XONG!
echo DA LUU GIT VA CAP NHAT WEB TREN MANG THANH CONG!
pause