@echo off
echo Dang kiem tra va tai du lieu tu GitHub...
:: Di chuyen den thu muc chua code (neu file .bat nam ngoai thu muc du an)
:: cd /d "D:\du_an_cua_ban"

:: Tai du lieu moi nhat tu server ve (nhung chua ghi de ngay)
git fetch origin main

:: Ep buoc code duoi may tro ve trang thai giong het tren GitHub (Ghi de moi thay doi o may)
git reset --hard origin/main

echo.
echo === CAP NHAT THANH CONG ===
pause