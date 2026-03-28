// AboutPage.jsx
export function AboutPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Logo from Tirupur Runners */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src="https://racemart.in/storage/partners/partner-1748525507271.jpg"
            alt="Tirupur Runners Logo"
            className="h-16 w-16 object-contain rounded-xl"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div>
            <h1 className="font-display font-bold text-4xl text-gray-900">About Us</h1>
            <p className="text-brand-600 font-medium text-sm">Tirupur Runners · Est. 2013</p>
          </div>
        </div>

        <p className="text-gray-500 text-lg leading-relaxed mb-8">
          Tirupur Runners was established in 2013 by a passionate community of local fitness enthusiasts
          who believed that running is more than a sport — it's a lifestyle that transforms communities.
          Our mission: <span className="italic text-gray-700">"Inspire the city to lace up, show up, and run together."</span>
        </p>

        {/* Marathon event image */}
        <div className="rounded-2xl overflow-hidden mb-10">
          <img
            src="https://racemart.in/storage/poster/poster-1748432314814.png"
            alt="Toplight Tirupur Runners Marathon"
            className="w-full object-cover max-h-64"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {[
            { emoji: '🌅', title: 'Our Mission', desc: 'Inspire the city to lace up, show up, and run together — promoting health, fitness, and community spirit across Tirupur and Tamil Nadu.' },
            { emoji: '🤝', title: 'Community First', desc: 'Over 250 active runners. Every runner matters — from first-timers to ultramarathoners. We train and grow together as one community.' },
            { emoji: '🏙️', title: 'Rooted in Tirupur', desc: "Proud to represent Tirupur — India's knitwear capital — on the national running map since 2013." },
            { emoji: '🏆', title: 'Toplight Marathon', desc: 'We organize the Toplight Tirupur Runners Marathon — a beloved Tamil Nadu event drawing 3500+ runners. Next edition: August 2, 2025.' },
          ].map((item) => (
            <div key={item.title} className="card flex gap-4">
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-brand-600 text-white rounded-2xl p-8">
          <h2 className="font-display font-bold text-2xl mb-3">Join our community</h2>
          <p className="text-brand-100">
            250+ runners. 52 weekly runs a year. One unforgettable annual marathon every August.
            New member annual membership — ₹2,000. Renewal — ₹1,500.
          </p>
        </div>
      </div>
    </div>
  )
}

// ContactPage.jsx
export function ContactPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display font-bold text-4xl text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-500 mb-8">Have questions? Reach out to our team.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {[
            { label: 'Email', value: 'tirupurrunnersmarathon@gmail.com', emoji: '📧' },
            { label: 'Phone', value: '+91 94882 52599', emoji: '📱' },
            { label: 'Location', value: 'VOC Park, Tirupur, TN 641604', emoji: '📍' },
            { label: 'Run Days', value: 'Every Sunday, 5:30 AM', emoji: '🕔' },
          ].map((item) => (
            <div key={item.label} className="card flex gap-3 items-start">
              <span className="text-xl">{item.emoji}</span>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-800">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Send a message</h2>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <input className="input-field" placeholder="Your name" />
              <input type="email" className="input-field" placeholder="Email address" />
            </div>
            <input className="input-field" placeholder="Subject" />
            <textarea className="input-field resize-none" rows={4} placeholder="Your message…" />
            <button className="btn-primary w-full">Send Message</button>
            <p className="text-xs text-gray-400 text-center">We'll get back to you within 24 hours.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
