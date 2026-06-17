import React from "react";
import "./Aboutus.css";

function AboutUsPage() {
const categories = [
"Hair Care",
"Perfumes",
"Makeup",
"Skin Care",
"Fruits & Veg",
"Meat",
"Frozen",
"Bakery",
"Pharmacy",
"Crockery",
"Home Appliances",
"Watches",
];

const values = [
{
title: "Customer First, Always",
description:
"We prioritize our customers in every decision, ensuring their needs and satisfaction come first.",
},
{
title: "Innovation With Purpose",
description:
"We embrace meaningful innovation that enhances value, efficiency, and experience.",
},
{
title: "Trust Through Quality",
description:
"We build long-term trust by consistently delivering genuine, high-quality products and services.",
},
{
title: "Accessibility For All",
description:
"We strive to make our offerings inclusive, convenient, and available to everyone.",
},
{
title: "Operational Excellence",
description:
"We pursue efficiency, discipline, and continuous improvement in everything we do.",
},
{
title: "Tech-Driven Convenience",
description:
"We leverage technology to simplify shopping and elevate the customer experience.",
},
];

const milestones = [
{
year: "1973",
title: "Humble Beginnings",
description:
"Started as a small local store focused on quality products and customer trust.",
},
{
year: "2003",
title: "Major Expansion",
description:
"Expanded operations to serve more customers with a wider range of products.",
},
{
year: "2014",
title: "Growing Stronger",
description:
"Continued expansion and improved shopping experience for customers.",
},
{
year: "2018",
title: "Digital Transformation",
description:
"Launched ecommerce services to bring convenience to online shoppers.",
},
{
year: "2023",
title: "Unified Brand Vision",
description:
"Strengthened our identity with a single vision across online and offline channels.",
},
{
year: "2024",
title: "Expanding Horizons",
description:
"Further growth with new locations and enhanced customer experiences.",
},
];

return ( <div className="about-page">
{/* HERO */} <section className="about-hero"> <div className="hero-overlay"> <div className="container"> <h1>About Our Store</h1> <p>
Building trust, delivering quality, and creating exceptional
shopping experiences for customers every day. </p>

```
        <button className="hero-btn">
          Explore Our Journey
        </button>
      </div>
    </div>
  </section>

  {/* STORY */}
  <section className="about-story section">
    <div className="container story-grid">
      <div>
        <span className="section-tag">Our Story</span>

        <h2>
          A Legacy Of Trust,
          <br />
          A Future Of Innovation
        </h2>

        <p>
          Since our beginning, we have focused on delivering quality,
          reliability, and customer satisfaction. What started as a small
          operation has grown into a trusted destination for thousands of
          shoppers.
        </p>

        <p>
          Our commitment to authentic products, excellent service, and
          continuous innovation remains at the heart of everything we do.
        </p>
      </div>

      <div>
        <img
          src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"
          alt="Our Story"
        />
      </div>
    </div>
  </section>

  {/* VISION MISSION */}
  <section className="vision-mission section">
    <div className="container vm-grid">
      <div className="vm-card">
        <h3>Our Vision</h3>

        <p>
          To become the most trusted and innovative retail destination,
          delivering seamless experiences across every shopping channel.
        </p>
      </div>

      <div className="vm-card">
        <h3>Our Mission</h3>

        <p>
          To enhance everyday life through authentic products, exceptional
          service, and technology-driven convenience.
        </p>
      </div>
    </div>
  </section>

  {/* CATEGORIES */}
  <section className="categories section">
    <div className="container">
      <h2 className="center-title">Our Categories</h2>

      <div className="category-grid">
        {categories.map((category) => (
          <div key={category} className="category-card">
            {category}
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* IMAGE BREAK */}
  <section className="image-break">
    <img
      src="https://images.unsplash.com/photo-1607082350899-7e105aa886ae"
      alt="Store"
    />
  </section>

  {/* VALUES */}
  <section className="values section">
    <div className="container">
      <h2 className="center-title">Core Values</h2>

      <div className="values-grid">
        {values.map((value) => (
          <div className="value-card" key={value.title}>
            <h3>{value.title}</h3>
            <p>{value.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* TIMELINE */}
  <section className="timeline-section section">
    <div className="container">
      <h2 className="center-title">Milestones</h2>

      <div className="timeline">
        {milestones.map((item) => (
          <div className="timeline-item" key={item.year}>
            <div className="timeline-year">{item.year}</div>

            <div className="timeline-content">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>

  {/* ECOMMERCE */}
  <section className="ecommerce section">
    <div className="container ecommerce-grid">
      <div>
        <img
          src="https://images.unsplash.com/photo-1520607162513-77705c0f0d4a"
          alt="Ecommerce"
        />
      </div>

      <div>
        <h2>Innovation In Ecommerce</h2>

        <p>
          We continue to invest in technology, logistics, and customer
          experience to make shopping faster, easier, and more reliable.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>80K+</h3>
            <span>Products</span>
          </div>

          <div className="stat-card">
            <h3>24/7</h3>
            <span>Online Access</span>
          </div>

          <div className="stat-card">
            <h3>Nationwide</h3>
            <span>Delivery</span>
          </div>

          <div className="stat-card">
            <h3>Trusted</h3>
            <span>By Customers</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/* HIGHLIGHTS */}
  <section className="highlights section">
    <div className="container">
      <h2 className="center-title">
        Key Highlights
      </h2>

      <div className="highlight-grid">
        <div className="highlight-card">Express Delivery</div>
        <div className="highlight-card">Nationwide Delivery</div>
        <div className="highlight-card">80,000+ Products</div>
        <div className="highlight-card">Roadside Pickup</div>
        <div className="highlight-card">Secure Shopping</div>
        <div className="highlight-card">Customer Support</div>
      </div>
    </div>
  </section>

  {/* PAYMENTS */}
  <section className="payments section">
    <div className="container">
      <h2 className="center-title">
        Payment Methods
      </h2>

      <div className="payment-grid">
        <div className="payment-card">Debit Card</div>
        <div className="payment-card">Credit Card</div>
        <div className="payment-card">Raast QR</div>
        <div className="payment-card">Bank Transfer</div>
        <div className="payment-card">Cash On Delivery</div>
        <div className="payment-card">Buy Now Pay Later</div>
      </div>
    </div>
  </section>

  {/* AWARDS */}
  <section className="awards section">
    <div className="container">
      <h2 className="center-title">
        Recognized For Excellence
      </h2>

      <div className="award-grid">
        <div className="award-card">Retail Excellence</div>
        <div className="award-card">Digital Innovation</div>
        <div className="award-card">Customer Service</div>
        <div className="award-card">Brand Trust</div>
      </div>
    </div>
  </section>

  {/* COMMITMENT */}
  <section className="commitment">
    <div className="container">
      <h2>Our Commitment</h2>

      <p>
        We remain committed to delivering authentic products, exceptional
        service, and seamless convenience through every customer
        interaction.
      </p>

      <button className="hero-btn">
        Start Shopping
      </button>
    </div>
  </section>
</div>
);
}

export default AboutUsPage;
