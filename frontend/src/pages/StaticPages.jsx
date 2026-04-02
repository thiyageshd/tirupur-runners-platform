import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { settingsApi } from '../api'
import logo from '../resources/Tirupur_Runners_Logo.jpg'

// AboutPage.jsx
export function AboutPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Logo from Tirupur Runners */}
        <div className="flex items-center gap-4 mb-8">
          <img
            src={logo}
            alt="Tirupur Runners Logo"
            className="h-16 w-16 object-contain rounded-xl"
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

        {/* Marathon event poster — natural portrait card, centered */}
        <div className="flex justify-center mb-10">
          <div className="w-60 rounded-2xl overflow-hidden shadow-lg ring-1 ring-gray-100">
            <img
              src="https://racemart.in/storage/poster/poster-1748432314814.png"
              alt="Toplight Tirupur Runners Marathon powered by Techno Sport — Coming Soon"
              className="w-full h-auto block"
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {[
            { emoji: '🌅', title: 'Our Mission', desc: 'Inspire the city to lace up, show up, and run together — promoting health, fitness, and community spirit across Tirupur and Tamil Nadu.' },
            { emoji: '🤝', title: 'Community First', desc: 'Over 250 active runners. Every runner matters — from first-timers to ultramarathoners. We train and grow together as one community.' },
            { emoji: '🏙️', title: 'Rooted in Tirupur', desc: "Proud to represent Tirupur — India's knitwear capital — on the national running map since 2013." },
            { emoji: '🏆', title: 'Tirupur Runners Marathon', desc: 'We organize the Toplight Tirupur Runners Marathon powered by Techno Sport — a beloved Tamil Nadu event drawing 6000+ runners. Next edition: Coming Soon.' },
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
            250+ runners. 52 weekly runs a year. One unforgettable annual marathon.
          </p>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_CONTACT = {
  contact_email: 'tirupurrunners@gmail.com',
  contact_phone: '+91 94882 52599',
  office_location: 'New No 12 B, Eswaran Kovil Street, Valarmathi Electricals Upstairs',
  run_day_time: 'Every Sunday, 5:30 AM',
  maps_link: 'https://maps.google.com/?q=Tirupur+Collectorate,Tirupur,Tamil+Nadu',
}

// ContactPage.jsx
export function ContactPage() {
  const [settings, setSettings] = useState(DEFAULT_CONTACT)

  useEffect(() => {
    settingsApi.get()
      .then((res) => setSettings({ ...DEFAULT_CONTACT, ...res.data }))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display font-bold text-4xl text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-500 mb-8">Have questions? Reach out to our team.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <div className="card flex gap-3 items-start">
            <span className="text-xl">📧</span>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <p className="text-sm font-medium text-gray-800">{settings.contact_email}</p>
            </div>
          </div>
          <div className="card flex gap-3 items-start">
            <a
              href={`https://wa.me/${(settings.contact_phone || '').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 items-start hover:opacity-80 transition-opacity"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 mt-0.5" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">WhatsApp</p>
                <p className="text-sm font-medium text-gray-800">{settings.contact_phone}</p>
              </div>
            </a>
          </div>
          <div className="card flex gap-3 items-start">
            <span className="text-xl">📍</span>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Office Location</p>
              <p className="text-sm font-medium text-gray-800">{settings.office_location}, Tirupur, TN</p>
              {settings.maps_link && (
                <a
                  href={settings.maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline flex items-center gap-1 mt-1"
                >
                  Get Directions <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
          <div className="card flex gap-3 items-start">
            <span className="text-xl">🕔</span>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Run Days</p>
              <p className="text-sm font-medium text-gray-800">{settings.run_day_time}</p>
            </div>
          </div>
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
