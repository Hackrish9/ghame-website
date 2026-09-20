/* Ghame Spice — site script
   Cart (stored in the visitor's browser), stock limits, WhatsApp ordering,
   shop search and filters, enquiry forms, and the WhatsApp chat panel.
   Settings come from window.GHAME (Settings in the management portal). */
(function () {
  "use strict";

  var CFG = window.GHAME || {};
  var CART_KEY = "ghame_cart_v1";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------- Helpers ----------
  function money(n) {
    n = Number(n) || 0;
    return "LKR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function waUrl(text) {
    return "https://wa.me/" + String(CFG.whatsapp || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text);
  }
  function openWhatsApp(text) {
    var win = window.open(waUrl(text), "_blank", "noopener");
    if (!win) window.location.href = waUrl(text);
  }
  function mailto(to, subject, body) {
    window.location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function orderRef() {
    var d = new Date();
    var p = function (x) { return String(x).padStart(2, "0"); };
    return (CFG.prefix || "GS") + "-" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + "-" + Math.floor(1000 + Math.random() * 9000);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var toastTimer;
  function toast(html) {
    var el = $("[data-toast]");
    if (!el) return;
    el.innerHTML = html;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("is-on"); }, 3200);
  }

  // ---------- Product data (built from the portal on every publish) ----------
  var feedPromise;
  function feed() {
    if (!feedPromise) {
      feedPromise = fetch("/products.json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
    return feedPromise;
  }
  function findVariant(products, id, sku) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (!p) return null;
    var v = p.variants.filter(function (x) { return x.sku === sku; })[0];
    return v ? { product: p, variant: v } : null;
  }

  // ---------- Cart store ----------
  function readCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* private mode */ }
    updateCount(items);
  }
  function updateCount(items) {
    items = items || readCart();
    var n = items.reduce(function (s, i) { return s + i.qty; }, 0);
    $$("[data-cart-count]").forEach(function (el) { el.textContent = n; el.hidden = n === 0; });
    $$("[data-cart-link]").forEach(function (el) { el.setAttribute("aria-label", "Cart, " + n + (n === 1 ? " item" : " items")); });
  }

  function addToCart(id, sku, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    return feed().then(function (products) {
      var hit = findVariant(products, id, sku);
      if (!hit) { toast("This product is no longer available."); return false; }
      if (!CFG.ordersOpen) { toast(escapeHtml(CFG.closedMessage || "Ordering is paused.")); return false; }
      var items = readCart();
      var line = items.filter(function (i) { return i.id === id && i.sku === sku; })[0];
      var current = line ? line.qty : 0;
      var max = hit.variant.stock;
      if (max <= 0) { toast("Sorry, " + escapeHtml(hit.product.title) + " " + escapeHtml(hit.variant.pack) + " is out of stock."); return false; }
      var next = Math.min(max, current + qty);
      if (line) line.qty = next; else items.push({ id: id, sku: sku, qty: next });
      writeCart(items);
      var capped = current + qty > max;
      toast((capped ? "Only " + max + " available. " : "Added to cart. ") + '<a href="/cart/">View cart</a>');
      return true;
    });
  }

  // ---------- Header menu ----------
  var menuBtn = $("[data-menu-toggle]");
  var nav = $("#main-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
  }

  // ---------- Quick add buttons on product cards ----------
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add]");
    if (!btn) return;
    btn.disabled = true;
    addToCart(btn.dataset.id, btn.dataset.sku, 1).then(function () { btn.disabled = false; });
  });

  // ---------- Product page ----------
  var product = $("[data-product]");
  if (product) {
    var qtyInput = $("[data-qty]", product);
    var priceEl = $("[data-price-display]", product);
    var stockEl = $("[data-stock-note]", product);
    var addBtn = $("[data-add-selected]", product);
    var waBtn = $("[data-wa-order]", product);

    var selected = function () { return $("[data-variant]:checked", product) || $("[data-variant]", product); };

    var refresh = function () {
      var v = selected();
      if (!v) return;
      var price = Number(v.dataset.price);
      var stock = parseInt(v.dataset.stock, 10) || 0;
      priceEl.textContent = price > 0 ? money(price) : (CFG.priceOnRequest || "Price on request");
      var pn = $("[data-price-note]", product);
      if (pn) pn.hidden = price > 0;
      stockEl.className = "stock-note";
      if (stock <= 0) { stockEl.textContent = "Out of stock"; stockEl.classList.add("is-out"); }
      else if (stock <= (CFG.lowStock || 5)) { stockEl.textContent = CFG.showStock ? "Only " + stock + " left" : "Low stock"; stockEl.classList.add("is-low"); }
      else { stockEl.textContent = "In stock"; }
      if (qtyInput) {
        qtyInput.max = Math.max(1, stock);
        if ((parseInt(qtyInput.value, 10) || 1) > stock && stock > 0) qtyInput.value = stock;
      }
      if (addBtn) {
        addBtn.disabled = stock <= 0;
        addBtn.textContent = stock <= 0 ? "Out of stock" : "Add to cart";
      }
      if (waBtn) {
        var q = qtyInput ? (parseInt(qtyInput.value, 10) || 1) : 1;
        waBtn.href = waUrl("Hello " + (CFG.brand || "Ghame") + ", I would like to order " + product.dataset.title + ", " + v.dataset.pack + " x " + q + ".");
      }
    };

    $$("[data-variant]", product).forEach(function (r) { r.addEventListener("change", refresh); });
    $$("[data-qty-step]", product).forEach(function (b) {
      b.addEventListener("click", function () {
        var max = parseInt(qtyInput.max, 10) || 99;
        var next = (parseInt(qtyInput.value, 10) || 1) + parseInt(b.dataset.qtyStep, 10);
        qtyInput.value = Math.min(max, Math.max(1, next));
        refresh();
      });
    });
    if (qtyInput) qtyInput.addEventListener("change", function () {
      var max = parseInt(qtyInput.max, 10) || 99;
      qtyInput.value = Math.min(max, Math.max(1, parseInt(qtyInput.value, 10) || 1));
      refresh();
    });
    if (addBtn) addBtn.addEventListener("click", function () {
      var v = selected();
      addToCart(product.dataset.id, v.value, qtyInput ? qtyInput.value : 1);
    });
    refresh();

    // Gallery
    var main = $("[data-gallery-main] img", product);
    $$("[data-thumb]", product).forEach(function (t) {
      t.addEventListener("click", function () {
        main.src = t.dataset.src;
        main.alt = t.dataset.alt;
        $("[data-gallery-main]", product).classList.toggle("is-illustration", /\.svg($|\?)/i.test(t.dataset.src));
        $$("[data-thumb]", product).forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
      });
    });
  }

  // ---------- Recipe: add all spices ----------
  $$("[data-add-all]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ids = btn.dataset.addAll.split(",");
      feed().then(function (products) {
        var items = readCart();
        var added = 0;
        ids.forEach(function (id) {
          var p = products.filter(function (x) { return x.id === id; })[0];
          if (!p) return;
          var v = p.variants.filter(function (x) { return x.stock > 0; })[0];
          if (!v) return;
          var line = items.filter(function (i) { return i.id === id && i.sku === v.sku; })[0];
          if (line) { if (line.qty < v.stock) line.qty += 1; } else items.push({ id: id, sku: v.sku, qty: 1 });
          added++;
        });
        writeCart(items);
        toast(added ? "Added " + added + " spices to your cart. <a href=\"/cart/\">View cart</a>" : "These spices are out of stock right now.");
      });
    });
  });

  // ---------- Shop search and filters ----------
  var shop = $("[data-shop]");
  if (shop) {
    var search = $("[data-shop-search]");
    var cards = $$("[data-shop-grid] [data-product-card]");
    var empty = $("[data-shop-empty]");
    var chips = $$("[data-cat]", shop);
    var params = new URLSearchParams(window.location.search);
    var state = { q: params.get("q") || "", cat: params.get("category") || "" };

    var apply = function () {
      var q = state.q.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (!state.cat || c.dataset.category === state.cat) && (!q || c.dataset.name.indexOf(q) > -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      chips.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)); });
      empty.hidden = shown > 0;
      var url = new URL(window.location.href);
      if (state.q) url.searchParams.set("q", state.q); else url.searchParams.delete("q");
      if (state.cat) url.searchParams.set("category", state.cat); else url.searchParams.delete("category");
      history.replaceState(null, "", url);
    };

    search.value = state.q;
    search.addEventListener("input", function () { state.q = search.value; apply(); });
    chips.forEach(function (b) { b.addEventListener("click", function () { state.cat = b.dataset.cat; apply(); }); });
    $("[data-shop-clear]").addEventListener("click", function () { state.q = ""; state.cat = ""; search.value = ""; apply(); search.focus(); });
    if (window.location.hash === "#search") search.focus();
    apply();
  }

  // ---------- Cart page ----------
  var cartRoot = $("[data-cart]");
  if (cartRoot) {
    var linesEl = $("[data-cart-lines]");
    var checkout = $("[data-checkout]");
    var sentBox = $("[data-cart-sent]");
    var lastLines = [];

    var render = function () {
      feed().then(function (products) {
        var items = readCart();
        var lines = [];
        var clean = [];
        items.forEach(function (i) {
          var hit = findVariant(products, i.id, i.sku);
          if (!hit) return; // product removed from the shop
          clean.push(i);
          lines.push({ item: i, product: hit.product, variant: hit.variant });
        });
        if (clean.length !== items.length) writeCart(clean);
        lastLines = lines;

        if (!lines.length) {
          linesEl.innerHTML = '<div class="empty"><p class="lead">Your cart is empty.</p><a class="btn btn-dark" href="/shop/">Go to the shop</a></div>';
          checkout.hidden = true;
          return;
        }

        var total = 0, count = 0, priceOnRequest = false;
        linesEl.innerHTML = lines.map(function (l, idx) {
          var v = l.variant, p = l.product, q = l.item.qty;
          var over = q > v.stock;
          var lineTotal = v.price > 0 ? v.price * q : 0;
          if (v.price > 0) total += lineTotal; else priceOnRequest = true;
          count += q;
          return '<article class="cart-line" data-idx="' + idx + '">' +
            '<img src="' + escapeHtml(p.image || "/assets/img/illustrations/seeds.svg") + '" alt="" loading="lazy">' +
            '<div><h3><a href="' + escapeHtml(p.url) + '">' + escapeHtml(p.title) + '</a></h3>' +
            '<p class="meta">' + escapeHtml(v.pack) + ", " + (v.price > 0 ? money(v.price) + " each" : escapeHtml(CFG.priceOnRequest || "Price on request")) + '</p>' +
            (v.stock <= 0 ? '<p class="warn">Now out of stock. Remove it to send your order.</p>' : over ? '<p class="warn">Only ' + v.stock + ' available.</p>' : "") +
            '<div class="row"><div class="qty" role="group" aria-label="Quantity for ' + escapeHtml(p.title) + '">' +
            '<button type="button" aria-label="Decrease" data-step="-1">&minus;</button>' +
            '<input type="number" min="1" max="' + Math.max(1, v.stock) + '" value="' + q + '" aria-label="Quantity" data-line-qty>' +
            '<button type="button" aria-label="Increase" data-step="1">+</button></div>' +
            '<button type="button" class="text-link btn-link" data-remove>Remove</button></div></div>' +
            '<p class="line-total">' + (v.price > 0 ? money(lineTotal) : "") + "</p></article>";
        }).join("");

        $("[data-cart-items]").textContent = count;
        $("[data-cart-total]").textContent = money(total);
        $("[data-cart-por]").hidden = !priceOnRequest;
        checkout.hidden = false;
      });
    };

    var setQty = function (idx, qty) {
      var l = lastLines[idx];
      if (!l) return;
      var items = readCart();
      var line = items.filter(function (i) { return i.id === l.item.id && i.sku === l.item.sku; })[0];
      if (!line) return;
      line.qty = Math.max(1, Math.min(Math.max(1, l.variant.stock), qty));
      writeCart(items);
      render();
    };

    linesEl.addEventListener("click", function (e) {
      var row = e.target.closest("[data-idx]");
      if (!row) return;
      var idx = parseInt(row.dataset.idx, 10);
      if (e.target.closest("[data-remove]")) {
        var l = lastLines[idx];
        writeCart(readCart().filter(function (i) { return !(i.id === l.item.id && i.sku === l.item.sku); }));
        render();
      } else if (e.target.closest("[data-step]")) {
        setQty(idx, lastLines[idx].item.qty + parseInt(e.target.closest("[data-step]").dataset.step, 10));
      }
    });
    linesEl.addEventListener("change", function (e) {
      if (!e.target.matches("[data-line-qty]")) return;
      setQty(parseInt(e.target.closest("[data-idx]").dataset.idx, 10), parseInt(e.target.value, 10) || 1);
    });

    var form = $("[data-checkout-form]");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("[data-form-error]", form);
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      form.elements.name.setAttribute("aria-invalid", String(!name));
      form.elements.phone.setAttribute("aria-invalid", String(!phone));
      if (!name || !phone) { err.textContent = "Add your name and phone number so we can confirm the order."; err.hidden = false; return; }
      var blocked = lastLines.filter(function (l) { return l.variant.stock <= 0 || l.item.qty > l.variant.stock; });
      if (blocked.length) { err.textContent = "Some items are no longer available in that quantity. Adjust your cart first."; err.hidden = false; return; }
      err.hidden = true;

      var ref = orderRef();
      var total = 0, por = false;
      var body = ["*New order " + ref + "*", ""];
      lastLines.forEach(function (l, i) {
        var v = l.variant, q = l.item.qty;
        var price = v.price > 0 ? money(v.price * q) : "price on request";
        if (v.price > 0) total += v.price * q; else por = true;
        body.push((i + 1) + ". " + l.product.title + ", " + v.pack + " x " + q + " = " + price + " (" + v.sku + ")");
      });
      body.push("", "Items total: " + money(total) + (por ? " plus items priced on request" : ""));
      body.push("Delivery: " + form.elements.method.value);
      body.push("", "Name: " + name, "Phone: " + phone);
      if (form.elements.address.value.trim()) body.push("Address: " + form.elements.address.value.trim());
      if (form.elements.city.value.trim()) body.push("City: " + form.elements.city.value.trim());
      if (form.elements.country && form.elements.country.value.trim()) body.push("Country: " + form.elements.country.value.trim());
      if (form.elements.note.value.trim()) body.push("Note: " + form.elements.note.value.trim());
      body.push("", "Please confirm stock, delivery charge and the final total.");

      openWhatsApp(body.join("\n"));
      $("[data-order-ref]").textContent = ref;
      sentBox.hidden = false;
      sentBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    var clearBtn = $("[data-cart-clear]");
    if (clearBtn) clearBtn.addEventListener("click", function () { writeCart([]); sentBox.hidden = true; render(); });

    render();
  }

  // ---------- Enquiry forms (quotation, export, contact) ----------
  $$("form[data-enquiry]").forEach(function (form) {
    var via = "whatsapp";
    $$("button[type=submit]", form).forEach(function (b) { b.addEventListener("click", function () { via = b.dataset.via || "whatsapp"; }); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("[data-form-error]", form);
      var missing = $$("[required]", form).filter(function (f) {
        var bad = !f.value.trim() || (f.type === "email" && f.value && !/^\S+@\S+\.\S+$/.test(f.value));
        f.setAttribute("aria-invalid", String(bad));
        return bad;
      });
      if (missing.length) {
        err.textContent = "Fill in: " + missing.map(function (f) { return $('label[for="' + f.id + '"]', form).textContent; }).join(", ") + ".";
        err.hidden = false;
        missing[0].focus();
        return;
      }
      err.hidden = true;
      var kind = form.dataset.enquiry;
      var title = kind === "quote" ? "Quotation request" : kind === "export" ? "Export enquiry" : "Website message";
      var lines = ["*" + title + "*", ""];
      $$("input, select, textarea", form).forEach(function (f) {
        if (!f.name || f.type === "submit") return;
        if (f.type === "checkbox") { if (f.checked) lines.push(f.value); return; }
        if (f.value.trim()) lines.push(f.name + ": " + f.value.trim());
      });
      var text = lines.join("\n");
      if (via === "email") mailto(kind === "contact" ? CFG.email : CFG.b2bEmail || CFG.email, title + " from the website", text.replace(/\*/g, ""));
      else openWhatsApp(text);
      toast(via === "email" ? "Your email app has opened with the message." : "WhatsApp has opened with your message. Press send there.");
    });
  });

  // ---------- WhatsApp chat panel ----------
  var wa = $("[data-wa]");
  if (wa) {
    var panel = $("#wa-panel");
    var toggles = $$("[data-wa-toggle]");
    var setOpen = function (open) {
      panel.hidden = !open;
      toggles.forEach(function (t) { t.setAttribute("aria-expanded", String(open)); });
      if (open) $("#wa-message").focus();
    };
    toggles.forEach(function (t) { t.addEventListener("click", function () { setOpen(panel.hidden); }); });
    $("[data-wa-close]").addEventListener("click", function () { setOpen(false); toggles[0].focus(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) setOpen(false); });

    $("[data-wa-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var topic = ($("[name=topic]:checked", wa) || {}).value || "";
      var msg = $("#wa-message").value.trim();
      var text = "Hello " + (CFG.brand || "Ghame") + ", I have a question about " + topic.toLowerCase() + "." + (msg ? "\n\n" + msg : "");
      openWhatsApp(text);
      setOpen(false);
    });

    // Open or closed, in Sri Lanka time, from the hours in Settings
    var status = $("[data-wa-status]");
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
      var now = get("hour") + ":" + get("minute");
      var openNow = (CFG.openDays || []).indexOf(get("weekday")) > -1 && now >= (CFG.openTime || "00:00") && now < (CFG.closeTime || "23:59");
      status.textContent = openNow ? "Open now." : "Closed now. Leave a message and we reply when we open. " + (CFG.hoursText || "");
      status.classList.toggle("is-open", openNow);
    } catch (e2) { /* keep the static hours text */ }
  }

  updateCount();
})();
