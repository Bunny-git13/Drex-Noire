import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getDatabase,
    ref,
    onValue,
    push,
    set,
    update
}
from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";


/* =====================================================
   FIREBASE
===================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyB5xI2RaZvBV3OQH6zgJSRPJqNbr6l1wII",
    authDomain: "drex-noire-f5906.firebaseapp.com",
    databaseURL: "https://drex-noire-f5906-default-rtdb.firebaseio.com",
    projectId: "drex-noire-f5906",
    storageBucket: "drex-noire-f5906.firebasestorage.app",
    messagingSenderId: "220525587244",
    appId: "1:220525587244:web:446836a28b59395bcb5a89"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);


/* =====================================================
   STATE
===================================================== */

let products = [];

let cart = JSON.parse(
    localStorage.getItem("drexCart") || "[]"
);

let currentUser = null;

let selectedPayment = null;

let upiId = "";
let upiName = "Drex Noiré";

let orders = [];

let authMode = "login";

let selectedProduct = null;


/* =====================================================
   PAGE NAVIGATION
===================================================== */

window.showPage = function(name){

    document
        .querySelectorAll(".page")
        .forEach(page =>
            page.classList.remove("active")
        );

    const page =
        document.getElementById(
            name + "Page"
        );

    if(page){

        page.classList.add("active");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    if(name === "orders"){
        renderOrders();
    }

};


/* =====================================================
   LOADER
===================================================== */

window.addEventListener("load", () => {

    setTimeout(() => {

        const loader =
            document.getElementById("loader");

        if(!loader) return;

        loader.style.opacity = "0";

        setTimeout(() => {
            loader.remove();
        }, 500);

    }, 600);

});


/* =====================================================
   PRODUCTS
===================================================== */

onValue(
    ref(db, "products"),

    snapshot => {

        const data =
            snapshot.val() || {};

        products =
            Object.entries(data)
            .map(([id, value]) => ({
                id,
                ...value
            }))
            .filter(
                product =>
                product.active !== false
            );

        renderProducts();

        /*
           Important:
           If an admin changes sizes while
           customer has the website open,
           products update automatically.
        */

        refreshCartProducts();

    },

    error => {

        console.error(error);

        toast(
            "Unable to load collection."
        );

    }
);


/* =====================================================
   UPI SETTINGS
===================================================== */

onValue(
    ref(db, "settings/store"),

    snapshot => {

        const data =
            snapshot.val() || {};

        upiId =
            data.upiId || "";

        upiName =
            data.upiName ||
            "Drex Noiré";

        const nameElement =
            document.getElementById(
                "upiDisplayName"
            );

        const idElement =
            document.getElementById(
                "upiDisplayId"
            );

        if(nameElement){
            nameElement.textContent =
                upiName;
        }

        if(idElement){
            idElement.textContent =
                upiId ||
                "UPI not configured";
        }

    }
);


/* =====================================================
   PRODUCTS RENDERING
===================================================== */

function renderProducts(){

    renderGrid(
        document.getElementById(
            "shopProducts"
        ),
        products
    );

    renderGrid(
        document.getElementById(
            "featuredProducts"
        ),
        products.slice(0, 4)
    );

}


function renderGrid(container, list){

    if(!container) return;

    if(!list.length){

        container.innerHTML = `
            <p style="
                padding:10px;
                color:#777;
                font-size:11px
            ">
                No products available.
            </p>
        `;

        return;
    }


    container.innerHTML =
        list.map(product => {

            const stock =
                Number(
                    product.stock || 0
                );

            return `

            <article class="product">

                <div
                    class="product-image"
                    onclick="openProduct('${product.id}')"
                >

                    <img
                        src="${safe(product.image)}"
                        alt="${safe(product.name)}"
                        onerror="
                            this.src='https://placehold.co/600x750?text=Drex+Noire'
                        "
                    >

                </div>

                <div class="product-info">

                    <small class="category">
                        ${safe(product.category)}
                    </small>

                    <h3>
                        ${safe(product.name)}
                    </h3>

                    <div class="price">
                        ₹${money(product.price)}
                    </div>

                    <div class="stock">

                        ${
                            stock > 0
                            ? "In stock"
                            : "Sold out"
                        }

                    </div>

                    <button
                        class="product-action"
                        onclick="openProduct('${product.id}')"
                        ${stock <= 0 ? "disabled" : ""}
                    >
                        ${stock > 0
                            ? "VIEW PRODUCT"
                            : "SOLD OUT"}
                    </button>

                </div>

            </article>

            `;

        }).join("");

}


/* =====================================================
   SEARCH
===================================================== */

const searchInput =
    document.getElementById(
        "searchInput"
    );

const categoryFilter =
    document.getElementById(
        "categoryFilter"
    );

if(searchInput){

    searchInput.addEventListener(
        "input",
        filterProducts
    );

}

if(categoryFilter){

    categoryFilter.addEventListener(
        "change",
        filterProducts
    );

}


function filterProducts(){

    const search =
        String(
            document.getElementById(
                "searchInput"
            )?.value || ""
        )
        .toLowerCase();

    const category =
        document.getElementById(
            "categoryFilter"
        )?.value || "all";


    const result =
        products.filter(product => {

            const name =
                String(
                    product.name || ""
                ).toLowerCase();

            const matchesSearch =
                name.includes(search);

            const matchesCategory =
                category === "all" ||
                product.category === category;

            return (
                matchesSearch &&
                matchesCategory
            );

        });


    renderGrid(
        document.getElementById(
            "shopProducts"
        ),
        result
    );

}


/* =====================================================
   NORMALIZE SIZES
===================================================== */

function getProductSizes(product){

    if(!product) return [];

    let sizes = product.sizes;

    if(!sizes) return [];


    /*
       Admin may save sizes as:

       ["S","M","L"]

       OR

       {
           S:true,
           M:true,
           L:true
       }

       OR

       {
           S:"S",
           M:"M",
           L:"L"
       }
    */


    if(Array.isArray(sizes)){

        return sizes
            .map(size =>
                String(size).trim()
            )
            .filter(Boolean);

    }


    if(typeof sizes === "object"){

        return Object.entries(sizes)
            .filter(
                ([key,value]) =>
                    value !== false &&
                    value !== null &&
                    value !== ""
            )
            .map(
                ([key,value]) => {

                    if(
                        value === true ||
                        value === 1
                    ){
                        return key;
                    }

                    return String(value);

                }
            )
            .filter(Boolean);

    }


    if(typeof sizes === "string"){

        return sizes
            .split(",")
            .map(size => size.trim())
            .filter(Boolean);

    }


    return [];

}


/* =====================================================
   PRODUCT DETAIL
===================================================== */

window.openProduct = function(id){

    const product =
        products.find(
            p => p.id === id
        );

    if(!product) return;

    selectedProduct = product;

    const sizes =
        getProductSizes(product);

    const stock =
        Number(
            product.stock || 0
        );


    let sizeHTML = "";


    if(sizes.length){

        sizeHTML = `

            <div class="size-section">

                <label class="size-label">
                    SELECT SIZE
                </label>

                <div class="size-options">

                    ${sizes.map(size => `

                        <button
                            type="button"
                            class="size-option"
                            onclick="selectSize(this,'${safeAttr(size)}')"
                        >
                            ${safe(size)}
                        </button>

                    `).join("")}

                </div>

                <p
                    id="sizeError"
                    class="error"
                ></p>

            </div>

        `;

    }


    document.getElementById(
        "productDetail"
    ).innerHTML = `

        <div class="detail-image">

            <img
                src="${safe(product.image)}"
                alt="${safe(product.name)}"
                onerror="
                    this.src='https://placehold.co/600x750?text=Drex+Noire'
                "
            >

        </div>

        <div class="detail-info">

            <small class="detail-category">
                ${safe(product.category)}
            </small>

            <h1>
                ${safe(product.name)}
            </h1>

            <div class="detail-price">
                ₹${money(product.price)}
            </div>

            <p class="description">
                ${safe(product.description)}
            </p>

            ${sizeHTML}

            <button
                class="black-btn full"
                onclick="addSelectedProductToCart()"
                ${stock <= 0 ? "disabled" : ""}
            >
                ${
                    stock > 0
                    ? "ADD TO BAG"
                    : "SOLD OUT"
                }
            </button>

        </div>

    `;

    showPage("product");

};


/* =====================================================
   SIZE SELECTION
===================================================== */

let selectedSize = "";


window.selectSize = function(button, size){

    selectedSize = size;

    document
        .querySelectorAll(
            ".size-option"
        )
        .forEach(
            b =>
            b.classList.remove(
                "selected"
            )
        );

    button.classList.add(
        "selected"
    );

    const error =
        document.getElementById(
            "sizeError"
        );

    if(error){
        error.textContent = "";
    }

};


window.addSelectedProductToCart =
function(){

    if(!selectedProduct) return;

    const sizes =
        getProductSizes(
            selectedProduct
        );


    /*
       If admin has assigned sizes,
       customer MUST select one.
    */

    if(
        sizes.length &&
        !selectedSize
    ){

        const error =
            document.getElementById(
                "sizeError"
            );

        if(error){

            error.textContent =
                "Please select a size.";

        }

        toast(
            "Please select a size."
        );

        return;

    }


    addToCart(
        selectedProduct.id,
        selectedSize
    );

};


/* =====================================================
   CART
===================================================== */

function saveCart(){

    localStorage.setItem(
        "drexCart",
        JSON.stringify(cart)
    );

}


function updateCartCount(){

    const count =
        cart.reduce(
            (sum, item) =>
            sum + Number(
                item.quantity || 0
            ),
            0
        );

    const element =
        document.getElementById(
            "cartCount"
        );

    if(element){
        element.textContent =
            count;
    }

}


updateCartCount();


window.addToCart = function(
    id,
    size = ""
){

    const product =
        products.find(
            p => p.id === id
        );

    if(!product) return;


    const stock =
        Number(
            product.stock || 0
        );

    if(stock <= 0){

        toast(
            "This product is sold out."
        );

        return;

    }


    const sizes =
        getProductSizes(product);


    if(
        sizes.length &&
        !size
    ){

        openProduct(id);

        toast(
            "Please select a size."
        );

        return;

    }


    /*
       Same product with different sizes
       becomes separate cart entries.
    */

    const existing =
        cart.find(
            item =>
                item.id === id &&
                String(
                    item.size || ""
                ) === String(size || "")
        );


    if(existing){

        if(
            existing.quantity >= stock
        ){

            toast(
                "Maximum available stock reached."
            );

            return;

        }

        existing.quantity++;

    }else{

        cart.push({

            id,

            size:
                size || "",

            quantity: 1

        });

    }


    saveCart();

    updateCartCount();

    toast(
        size
        ? `${size} added to bag.`
        : "Added to bag."
    );

};


window.openCart = function(){

    renderCart();

    document
        .getElementById(
            "cartOverlay"
        )
        .classList.add("show");

};


window.closeCart = function(){

    document
        .getElementById(
            "cartOverlay"
        )
        .classList.remove("show");

};


/* =====================================================
   CART RENDER
===================================================== */

function renderCart(){

    const container =
        document.getElementById(
            "cartItems"
        );

    if(!container) return;


    if(!cart.length){

        container.innerHTML =
            "<p>Your bag is empty.</p>";

        document.getElementById(
            "cartTotal"
        ).textContent =
            "₹0";

        return;

    }


    let total = 0;


    container.innerHTML =
        cart.map((item, index) => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            if(!product) return "";


            const amount =
                Number(
                    product.price || 0
                ) *
                Number(
                    item.quantity || 1
                );


            total += amount;


            return `

                <div class="cart-item">

                    <img
                        src="${safe(product.image)}"
                        alt=""
                        onerror="
                            this.src='https://placehold.co/200x250?text=DN'
                        "
                    >

                    <div>

                        <h4>
                            ${safe(product.name)}
                        </h4>

                        ${
                            item.size
                            ? `
                            <p>
                                Size:
                                <b>
                                    ${safe(item.size)}
                                </b>
                            </p>
                            `
                            : ""
                        }

                        <p>
                            ₹${money(product.price)}
                            × ${item.quantity}
                        </p>

                    </div>

                    <button
                        class="remove"
                        onclick="removeCart(${index})"
                    >
                        REMOVE
                    </button>

                </div>

            `;

        }).join("");


    document.getElementById(
        "cartTotal"
    ).textContent =
        "₹" + money(total);

}


/* =====================================================
   REMOVE CART ITEM
===================================================== */

window.removeCart = function(index){

    cart.splice(index, 1);

    saveCart();

    updateCartCount();

    renderCart();

};


/* =====================================================
   REFRESH CART AFTER FIREBASE UPDATE
===================================================== */

function refreshCartProducts(){

    let changed = false;


    cart = cart.filter(item => {

        const product =
            products.find(
                p => p.id === item.id
            );

        if(!product){

            changed = true;

            return false;

        }


        const stock =
            Number(
                product.stock || 0
            );


        if(stock <= 0){

            changed = true;

            return false;

        }


        if(
            item.quantity > stock
        ){

            item.quantity =
                stock;

            changed = true;

        }


        const sizes =
            getProductSizes(product);


        if(
            item.size &&
            sizes.length &&
            !sizes.includes(
                item.size
            )
        ){

            /*
               Do not silently delete the item.
               Customer will see that the size
               needs to be selected again.
            */

        }


        return true;

    });


    if(changed){

        saveCart();

        updateCartCount();

    }

}


/* =====================================================
   CHECKOUT
===================================================== */

window.openCheckout = function(){

    if(!cart.length){

        toast(
            "Your bag is empty."
        );

        return;

    }


    if(!currentUser){

        closeCart();

        openAuth("login");

        toast(
            "Login required for checkout."
        );

        return;

    }


    /*
       Validate sizes before checkout.
    */

    for(const item of cart){

        const product =
            products.find(
                p => p.id === item.id
            );

        if(!product) continue;

        const sizes =
            getProductSizes(product);


        if(
            sizes.length &&
            !item.size
        ){

            closeCart();

            openProduct(product.id);

            toast(
                `Select a size for ${product.name}.`
            );

            return;

        }

    }


    closeCart();

    selectedPayment = null;

    renderCheckout();

    showPage("checkout");

};


function cartTotal(){

    return cart.reduce(
        (total, item) => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            return total +
                (
                    Number(
                        product?.price || 0
                    ) *
                    Number(
                        item.quantity || 0
                    )
                );

        },
        0
    );

}


/* =====================================================
   CHECKOUT SUMMARY
===================================================== */

function renderCheckout(){

    let total = 0;

    const box =
        document.getElementById(
            "checkoutItems"
        );

    if(!box) return;


    box.innerHTML =
        cart.map(item => {

            const product =
                products.find(
                    p =>
                    p.id === item.id
                );

            if(!product) return "";


            const amount =
                Number(
                    product.price || 0
                ) *
                Number(
                    item.quantity || 0
                );


            total += amount;


            return `

                <div class="summary-item">

                    <span>

                        ${safe(product.name)}

                        ${
                            item.size
                            ? `
                            <small>
                                Size:
                                ${safe(item.size)}
                            </small>
                            `
                            : ""
                        }

                        ×${item.quantity}

                    </span>

                    <b>
                        ₹${money(amount)}
                    </b>

                </div>

            `;

        }).join("");


    document.getElementById(
        "checkoutTotal"
    ).textContent =
        "₹" + money(total);


    updateCOD(total);

}


/* =====================================================
   COD
===================================================== */

function updateCOD(total){

    const button =
        document.getElementById(
            "codButton"
        );

    const message =
        document.getElementById(
            "codMessage"
        );


    if(!button) return;


    if(total > 9999){

        button.disabled = true;

        if(message){

            message.textContent =
                "Unavailable above ₹9,999";

        }


        if(selectedPayment === "COD"){

            selectedPayment = null;

        }

    }else{

        button.disabled = false;

        if(message){

            message.textContent =
                "Available for eligible orders";

        }

    }

}


/* =====================================================
   PAYMENT SELECTION
===================================================== */

window.selectPayment = function(method){

    const total =
        cartTotal();


    if(
        method === "COD" &&
        total > 9999
    ){

        toast(
            "COD unavailable above ₹9,999."
        );

        return;

    }


    selectedPayment = method;


    document
        .getElementById(
            "upiButton"
        )
        ?.classList.remove(
            "selected"
        );


    document
        .getElementById(
            "codButton"
        )
        ?.classList.remove(
            "selected"
        );


    document
        .getElementById(
            "upiBox"
        )
        ?.classList.add(
            "hidden"
        );


    if(method === "UPI"){

        document
            .getElementById(
                "upiButton"
            )
            ?.classList.add(
                "selected"
            );

        document
            .getElementById(
                "upiBox"
            )
            ?.classList.remove(
                "hidden"
            );

    }else{

        document
            .getElementById(
                "codButton"
            )
            ?.classList.add(
                "selected"
            );

    }

};


/* =====================================================
   UPI
===================================================== */

window.openUPI = function(){

    if(!upiId){

        toast(
            "UPI ID is not configured."
        );

        return;

    }


    const amount =
        cartTotal();


    const url =
        "upi://pay" +
        "?pa=" +
        encodeURIComponent(upiId) +
        "&pn=" +
        encodeURIComponent(upiName) +
        "&am=" +
        encodeURIComponent(amount) +
        "&cu=INR" +
        "&tn=" +
        encodeURIComponent(
            "Drex Noire Order"
        );


    window.location.href =
        url;

};


/* =====================================================
   PLACE ORDER
===================================================== */

window.placeOrder = async function(){

    if(!currentUser){

        toast(
            "Login required."
        );

        return;

    }


    if(!cart.length){

        toast(
            "Your bag is empty."
        );

        return;

    }


    if(!selectedPayment){

        toast(
            "Select a payment method."
        );

        return;

    }


    const name =
        document.getElementById(
            "checkoutName"
        ).value.trim();

    const email =
        document.getElementById(
            "checkoutEmail"
        ).value.trim();

    const phone =
        document.getElementById(
            "checkoutPhone"
        ).value.trim();

    const address =
        document.getElementById(
            "checkoutAddress"
        ).value.trim();

    const city =
        document.getElementById(
            "checkoutCity"
        ).value.trim();

    const state =
        document.getElementById(
            "checkoutState"
        ).value.trim();

    const pin =
        document.getElementById(
            "checkoutPin"
        ).value.trim();


    if(
        !name ||
        !email ||
        !phone ||
        !address ||
        !city ||
        !state ||
        !pin
    ){

        toast(
            "Complete all delivery fields."
        );

        return;

    }


    const total =
        cartTotal();


    if(
        selectedPayment === "COD" &&
        total > 9999
    ){

        toast(
            "COD unavailable above ₹9,999."
        );

        return;

    }


    /*
       Final size validation.
    */

    for(const item of cart){

        const product =
            products.find(
                p => p.id === item.id
            );

        if(!product) continue;


        const sizes =
            getProductSizes(product);


        if(
            sizes.length &&
            !item.size
        ){

            toast(
                `Select a size for ${product.name}.`
            );

            openProduct(product.id);

            return;

        }


        if(
            sizes.length &&
            !sizes.includes(
                item.size
            )
        ){

            toast(
                `Selected size is no longer available for ${product.name}.`
            );

            openProduct(product.id);

            return;

        }

    }


    try{

        const orderRef =
            push(
                ref(db, "orders")
            );


        const items =
            cart.map(item => {

                const product =
                    products.find(
                        p =>
                        p.id === item.id
                    );


                return {

                    productId:
                        item.id,

                    productName:
                        product?.name || "",

                    price:
                        Number(
                            product?.price || 0
                        ),

                    quantity:
                        Number(
                            item.quantity || 1
                        ),

                    size:
                        item.size || "",

                    image:
                        product?.image || ""

                };

            });


        await set(
            orderRef,
            {

                orderId:
                    orderRef.key,

                userId:
                    currentUser.uid,

                customerName:
                    name,

                customerEmail:
                    email,

                phone:
                    phone,

                address:
                    `${address}, ${city}, ${state} - ${pin}`,

                items,

                total,

                paymentMethod:
                    selectedPayment,

                paymentStatus:
                    selectedPayment === "COD"
                    ? "Pending"
                    : "Manual Verification",

                status:
                    "Pending",

                createdAt:
                    Date.now()

            }
        );


        await update(
            ref(
                db,
                "customers/" +
                currentUser.uid
            ),
            {

                name,

                email,

                phone,

                lastOrderAt:
                    Date.now()

            }
        );


        cart = [];

        saveCart();

        updateCartCount();


        toast(
            "Order placed successfully."
        );


        setTimeout(
            () => {

                showPage(
                    "orders"
                );

            },
            700
        );


    }catch(error){

        console.error(error);

        toast(
            "Order could not be placed."
        );

    }

};


/* =====================================================
   AUTH
===================================================== */

window.openAuth = function(mode){

    authMode = mode;


    document
        .getElementById(
            "authModal"
        )
        .classList.add(
            "show"
        );


    document.getElementById(
        "authTitle"
    ).textContent =
        mode === "login"
        ? "Login"
        : "Create Account";


    document.getElementById(
        "authSubmit"
    ).textContent =
        mode === "login"
        ? "LOGIN"
        : "CREATE ACCOUNT";


    document
        .getElementById(
            "signupNameField"
        )
        .classList.toggle(
            "hidden",
            mode === "login"
        );

};


window.closeAuth = function(){

    document
        .getElementById(
            "authModal"
        )
        .classList.remove(
            "show"
        );

};


window.submitAuth = async function(){

    const email =
        document.getElementById(
            "authEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "authPassword"
        ).value;

    const name =
        document.getElementById(
            "authName"
        ).value.trim();

    const error =
        document.getElementById(
            "authError"
        );


    error.textContent = "";


    if(!email || !password){

        error.textContent =
            "Enter your email and password.";

        return;

    }


    try{

        if(authMode === "login"){

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            closeAuth();

            toast(
                "Welcome back."
            );

        }else{

            if(!name){

                error.textContent =
                    "Enter your name.";

                return;

            }


            const result =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            await set(
                ref(
                    db,
                    "customers/" +
                    result.user.uid
                ),
                {

                    uid:
                        result.user.uid,

                    name,

                    email,

                    createdAt:
                        Date.now()

                }
            );


            closeAuth();

            toast(
                "Account created."
            );

        }

    }catch(e){

        console.error(e);

        error.textContent =
            getAuthError(e);

    }

};


/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(
    auth,

    user => {

        currentUser = user;


        if(user){

            document
                .getElementById(
                    "loggedOut"
                )
                .classList.add(
                    "hidden"
                );


            document
                .getElementById(
                    "loggedIn"
                )
                .classList.remove(
                    "hidden"
                );


            document.getElementById(
                "accountEmail"
            ).textContent =
                user.email;


            loadCustomer();

            loadOrders();


        }else{

            document
                .getElementById(
                    "loggedOut"
                )
                .classList.remove(
                    "hidden"
                );


            document
                .getElementById(
                    "loggedIn"
                )
                .classList.add(
                    "hidden"
                );


            document.getElementById(
                "accountEmail"
            ).textContent =
                "";

        }

    }
);


/* =====================================================
   CUSTOMER DATA
===================================================== */

function loadCustomer(){

    if(!currentUser) return;


    onValue(
        ref(
            db,
            "customers/" +
            currentUser.uid
        ),

        snapshot => {

            const data =
                snapshot.val() || {};


            const title =
                document.getElementById(
                    "accountTitle"
                );

            if(title){

                title.textContent =
                    data.name ||
                    "Welcome";

            }


            const name =
                document.getElementById(
                    "checkoutName"
                );

            const email =
                document.getElementById(
                    "checkoutEmail"
                );

            const phone =
                document.getElementById(
                    "checkoutPhone"
                );


            if(name){

                name.value =
                    data.name || "";

            }


            if(email){

                email.value =
                    data.email ||
                    currentUser.email;

            }


            if(phone){

                phone.value =
                    data.phone || "";

            }

        }
    );

}


/* =====================================================
   ORDERS
===================================================== */

function loadOrders(){

    if(!currentUser) return;


    onValue(
        ref(db, "orders"),

        snapshot => {

            const data =
                snapshot.val() || {};


            orders =
                Object.entries(data)
                .map(([id, value]) => ({
                    id,
                    ...value
                }))
                .filter(
                    order =>
                    order.userId ===
                    currentUser.uid
                )
                .sort(
                    (a,b) =>
                    (b.createdAt || 0) -
                    (a.createdAt || 0)
                );


            renderOrders();

        }
    );

}


/* =====================================================
   ORDER HISTORY
===================================================== */

function renderOrders(){

    const box =
        document.getElementById(
            "ordersContainer"
        );

    if(!box) return;


    if(!currentUser){

        box.innerHTML = `

            <div class="account">

                <h3>
                    Login to view orders.
                </h3>

                <button
                    class="black-btn full"
                    onclick="openAuth('login')"
                >
                    LOGIN
                </button>

            </div>

        `;

        return;

    }


    if(!orders.length){

        box.innerHTML = `

            <div class="account">

                <h3>
                    No orders yet.
                </h3>

                <button
                    class="black-btn full"
                    onclick="showPage('shop')"
                >
                    SHOP NOW
                </button>

            </div>

        `;

        return;

    }


    box.innerHTML =
        orders.map(order => {

            const first =
                order.items?.[0];


            const status =
                String(
                    order.status ||
                    "Pending"
                )
                .toLowerCase();


            const size =
                first?.size || "";


            return `

                <article class="order">

                    <div class="order-top">

                        <div>

                            <div class="order-id">
                                #${safe(
                                    order.orderId ||
                                    order.id
                                )}
                            </div>

                            <div class="order-date">
                                ${date(
                                    order.createdAt
                                )}
                            </div>

                        </div>

                        <div class="
                            status
                            ${safe(status)}
                        ">
                            ${safe(
                                order.status ||
                                "Pending"
                            )}
                        </div>

                    </div>


                    <div class="order-body">

                        <p>
                            ${
                                first
                                ? safe(
                                    first.productName
                                  )
                                : "Order"
                            }

                            ${
                                order.items?.length > 1
                                ? ` + ${
                                    order.items.length - 1
                                  } more`
                                : ""
                            }
                        </p>


                        ${
                            size
                            ? `
                            <p>
                                Size:
                                <b>
                                    ${safe(size)}
                                </b>
                            </p>
                            `
                            : ""
                        }


                        <p>
                            Payment:
                            ${safe(
                                order.paymentMethod
                            )}
                        </p>


                        <p>
                            <b>
                                Total:
                                ₹${money(order.total)}
                            </b>
                        </p>

                    </div>

                </article>

            `;

        }).join("");

}


/* =====================================================
   LOGOUT
===================================================== */

window.logout = async function(){

    await signOut(auth);

    toast(
        "Logged out."
    );

};


/* =====================================================
   HELPERS
===================================================== */

function money(value){

    return Number(
        value || 0
    ).toLocaleString(
        "en-IN"
    );

}


function date(value){

    if(!value) return "";

    return new Date(
        Number(value)
    ).toLocaleDateString(
        "en-IN"
    );

}


function safe(value){

    return String(
        value ?? ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/*
   Used when inserting size into
   an HTML attribute.
*/

function safeAttr(value){

    return String(
        value ?? ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    )
    .replace(
        /"/g,
        "&quot;"
    );

}


function getAuthError(error){

    const code =
        error?.code || "";


    const messages = {

        "auth/invalid-email":
            "Please enter a valid email.",

        "auth/user-not-found":
            "No account found with this email.",

        "auth/wrong-password":
            "Incorrect password.",

        "auth/invalid-credential":
            "Incorrect email or password.",

        "auth/email-already-in-use":
            "An account already exists with this email.",

        "auth/weak-password":
            "Password is too weak.",

        "auth/network-request-failed":
            "Network error. Check your internet connection."

    };


    return (
        messages[code] ||
        "Unable to complete authentication."
    );

}


function toast(message){

    const t =
        document.getElementById(
            "toast"
        );

    if(!t) return;


    t.textContent =
        message;

    t.classList.add(
        "show"
    );


    clearTimeout(
        window.__toastTimer
    );


    window.__toastTimer =
        setTimeout(
            () => {

                t.classList.remove(
                    "show"
                );

            },
            2500
        );

}