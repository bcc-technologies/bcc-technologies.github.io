// blog.js
document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');

    menuToggle.addEventListener('click', function () {
        nav.classList.toggle('active');
    });

    // Shopify integration
    const client = ShopifyBuy.buildClient({
        domain: '2e2e5e-7c.myshopify.com',
        storefrontAccessToken: '60ee1e20cccd72924afe74642353e01c'
    });

    function updateBlogPosts(articles) {
        const blogContainer = document.querySelector('.blog');
        blogContainer.innerHTML = `<h3>Bienvenido al Blog</h3>` + 
        articles.map(article => `
            <article class="entrada">
                <div class="entrada__imagen">
                    <picture>
                        <img loading="lazy" src="${article.image.src}" alt="${article.title}">
                    </picture>
                </div>
                <div class="entrada__contenido">
                    <h4 class="no-margin">${article.title}</h4>
                    <p>${article.excerptHtml}</p>
                    <a href="${article.url}" class="boton boton--primario">Leer Entrada</a>
                </div>
            </article>
        `).join('');
    }

    function updateServices(products) {
        const servicesContainer = document.querySelector('.cursos');
        servicesContainer.innerHTML = products.map(product => `
            <li class="widget-curso">
                <h4 class="no-margin">${product.title}</h4>
                <p class="widget-curso__label">Valor: 
                    <span class="widget-curso__info">${product.variants[0].price} (DOP)</span>
                </p>
                <a href="./services" class="boton boton--secundario">Explorar Servicios</a>
            </li>
        `).join('');
    }

    // Fetch blog posts
    client.article.fetchAll()
        .then(updateBlogPosts)
        .catch(error => {
            console.error('Error fetching Shopify articles:', error);
        });

    // Fetch services
    client.product.fetchAll()
        .then(updateServices)
        .catch(error => {
            console.error('Error fetching Shopify products:', error);
        });

    // Confetti when reaching the bottom of the page
    window.addEventListener('scroll', function () {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 1.0 }
            });
        }
    });
});
