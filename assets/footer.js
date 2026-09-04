var activityEvents, script_loaded = !1;
if (void 0 === __isPSA) var __isPSA = !1;
if (void 0 === uLTS) {
    var uLTS = new MutationObserver(e => {});
    uLTS.observe(document.documentElement, {
        childList: !0,
        subtree: !0
    })
}

function loadJSscripts() {
    script_loaded || (void 0 !== uLTS && uLTS.disconnect(), void 0 !== window.yett && window.yett.unblock(), script_loaded = !0, document.querySelectorAll("iframe[data-src], script[data-src]").forEach(e => {
        null != (datasrc = e.dataset.src) && (e.src = datasrc)
    }), document.querySelectorAll("link[data-href]").forEach(e => {
        null != (datahref = e.dataset.href) && (e.href = datahref)
    }), document.querySelectorAll("script[type='text/lazyload']").forEach(e => {
        var t = document.createElement("script");
        for (a = 0; a < e.attributes.length; a++) {
            var r = e.attributes[a];
            t.setAttribute(r.name, r.value)
        }
        t.type = "text/javascript", t.innerHTML = e.innerHTML, e.parentNode.insertBefore(t, e), e.parentNode.removeChild(e)
    }), document.dispatchEvent(new CustomEvent("asyncLazyLoader")), setTimeout(function() {
        document.dispatchEvent(new CustomEvent("loadBarInjectorer"))
    }, 1e3))
}(Function, __isPSA) ? ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "keypress", "touchmove"].forEach(function(e) {
    window.addEventListener(e, loadJSscripts, !1)
}): loadJSscripts();