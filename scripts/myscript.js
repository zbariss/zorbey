document.addEventListener("DOMContentLoaded", function () {
    const sayacElementleri = document.querySelectorAll('.istatistik-kutu h3');
    
    if (sayacElementleri.length > 0) {
        const saymaSuresiMilisaniye = 1500;

        sayacElementleri.forEach(el => {
            if (!el.dataset.orjinal) {
                el.dataset.orjinal = el.innerText;
            }
        });

        const sayacBaslat = (element) => {
            const hamMetin = element.dataset.orjinal;
            const hedefSayiString = hamMetin.replace(/[^0-9]/g, '');
            const metinEki = hamMetin.replace(/[0-9.]/g, ''); 
            const hedefSayi = parseInt(hedefSayiString);
            
            if (isNaN(hedefSayi)) return;

            const baslangicZamani = performance.now();
            
            const animasyonAdimi = (suankiZaman) => {
                const gecenSure = suankiZaman - baslangicZamani;
                let ilerleme = gecenSure / saymaSuresiMilisaniye;
                if (ilerleme > 1) ilerleme = 1;
                
                const easeOutIlerleme = 1 - Math.pow(1 - ilerleme, 2); 
                const suankiDeger = Math.floor(easeOutIlerleme * hedefSayi);
                
                element.innerText = suankiDeger.toLocaleString('tr-TR') + metinEki;
                
                if (ilerleme < 1) {
                    requestAnimationFrame(animasyonAdimi);
                }
            };
            requestAnimationFrame(animasyonAdimi);
        };

        const gozlemci = new IntersectionObserver((girdiler) => {
            girdiler.forEach(girdi => {
                if (girdi.isIntersecting) {
                    sayacBaslat(girdi.target);
                    gozlemci.unobserve(girdi.target); // İşte çakışmayı önleyen altın dokunuş!
                }
            });
        }, { threshold: 0.1 });

        sayacElementleri.forEach(sayac => gozlemci.observe(sayac));
    }

    const tumPaket = document.getElementById('paket-tum');
    const teorikPaket = document.getElementById('paket-teorik');
    const kapaliPaket = document.getElementById('paket-kapali');
    const yolPaket = document.getElementById('paket-yol');

    if (tumPaket && teorikPaket && kapaliPaket && yolPaket) {
        function paketYonetimi(e) {
            if (e.target === tumPaket && tumPaket.checked) {
                teorikPaket.checked = false;
                kapaliPaket.checked = false;
                yolPaket.checked = false;
            } else if (e.target !== tumPaket) {
                if (teorikPaket.checked && kapaliPaket.checked && yolPaket.checked) {
                    tumPaket.checked = true;
                    teorikPaket.checked = false;
                    kapaliPaket.checked = false;
                    yolPaket.checked = false;
                } else if (teorikPaket.checked || kapaliPaket.checked || yolPaket.checked) {
                    tumPaket.checked = false;
                }
            }
        }

        tumPaket.addEventListener('change', paketYonetimi);
        teorikPaket.addEventListener('change', paketYonetimi);
        kapaliPaket.addEventListener('change', paketYonetimi);
        yolPaket.addEventListener('change', paketYonetimi);
    }
});