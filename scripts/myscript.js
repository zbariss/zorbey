function sepeteEkle(isim, fiyat) {
    let sepet = localStorage.getItem("sepetim");
    
    if (sepet === null) {
        sepet = [];
    } else {
        sepet = JSON.parse(sepet);
    }

    sepet.push({ urunIsim: isim, urunFiyat: fiyat });
    localStorage.setItem("sepetim", JSON.stringify(sepet));
    alert(isim + " sepetinize eklendi!");
}

function sepetiGoster() {
    let sepetListesi = document.getElementById("sepet-listesi");
    let sepetToplam = document.getElementById("sepet-toplam");
    
    if (!sepetListesi) {
        return;
    }

    let sepet = localStorage.getItem("sepetim");
    
    if (sepet === null || JSON.parse(sepet).length === 0) {
        sepetListesi.innerHTML = "<p>Sepetiniz şu anda boş.</p>";
        sepetToplam.innerHTML = "Toplam Tutar: 0 TL";
        return;
    }

    sepet = JSON.parse(sepet);
    sepetListesi.innerHTML = "";
    let toplam = 0;

    for (let i = 0; i < sepet.length; i++) {
        sepetListesi.innerHTML += "<p>" + sepet[i].urunIsim + " - " + sepet[i].urunFiyat + " TL</p>";
        toplam += sepet[i].urunFiyat;
    }

    sepetToplam.innerHTML = "Toplam Tutar: " + toplam + " TL";
}

function sepetiTemizle() {
    localStorage.removeItem("sepetim");
    alert("Sepetiniz temizlendi!");
    sepetiGoster();
}

// Sayfa yüklendiğinde butonları ve fonksiyonları bağlayan alan
window.onload = function() {
    sepetiGoster();

    let btnEkle = document.getElementById("btn-sepete-ekle");
    if (btnEkle) {
        btnEkle.addEventListener("click", function() {
            let isim = btnEkle.getAttribute("data-isim");
            let fiyat = parseInt(btnEkle.getAttribute("data-fiyat"));
            sepeteEkle(isim, fiyat);
        });
    }

    let btnTemizle = document.getElementById("btn-sepeti-temizle");
    if (btnTemizle) {
        btnTemizle.addEventListener("click", sepetiTemizle);
    }
};