import { Calendar, MapPin, Clock, ArrowRight, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const MAPS_URL = 'https://maps.google.com/?q=Tirupur+Collectorate,Tirupur,Tamil+Nadu'

const EVENTS = [
  {
    title: 'Sunday Morning Run',
    date: 'Every Sunday',
    time: '5:30 AM',
    location: 'Tirupur Collectorate',
    mapsUrl: MAPS_URL,
    category: 'Weekly',
    desc: 'Our flagship weekly run. All paces welcome — 5K, 10K, or custom routes.',
    color: 'brand',
  },
  {
    title: 'Toplight Tirupur Runners Marathon',
    date: 'Date TBA — Stay Tuned!',
    time: '5:00 AM',
    location: 'Tirupur City Circuit',
    category: 'Marathon',
    desc: 'Annual flagship event with 5K, 10K & 21K categories. 3500+ runners expected. Register at toplighttirupurrunnersmarathon.com — Something big is coming to Tirupur. Watch this space.',
    color: 'purple',
    dateTba: true,
  },
  {
    title: 'Trail Running Weekend',
    date: 'Quarterly',
    time: '5:00 AM',
    location: 'Anaimalai Hills',
    category: 'Trail',
    desc: 'Escape the city. Scenic trail runs with experienced guides in the Western Ghats.',
    color: 'amber',
  },
]

const CATEGORY_COLORS = {
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
}

const BADGE_COLORS = {
  brand: 'bg-brand-100 text-brand-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
}

export default function EventsPage() {
  const { settings, user } = useAuthStore()
  const showJoin = !user && settings?.show_join_club !== 'false'

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-display font-bold text-4xl text-gray-900 mb-3">Events & Runs</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            From Sunday dawns to marathon mornings — every run is a reason to show up.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {EVENTS.map((event) => (
            <div
              key={event.title}
              className={`card border-l-4 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-6 ${CATEGORY_COLORS[event.color]}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${BADGE_COLORS[event.color]}`}>
                    {event.category}
                  </span>
                  {event.dateTba && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                      🎯 Coming Soon
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-xl text-gray-900 mb-2">{event.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{event.desc}</p>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className={`flex items-center gap-1.5 ${event.dateTba ? 'text-gray-400 italic' : ''}`}>
                    <Calendar size={14} /> {event.date}
                  </span>
                  <span className="flex items-center gap-1.5"><Clock size={14} /> {event.time}</span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {event.mapsUrl ? (
                      <a
                        href={event.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-brand-600 flex items-center gap-1"
                      >
                        {event.location} <ExternalLink size={11} />
                      </a>
                    ) : (
                      event.location
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center bg-brand-50 border border-brand-100 rounded-2xl p-8">
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">
            Want to join these runs?
          </h2>
          <p className="text-gray-500 mb-6">Become a member — ₹2,000 for new members · ₹1,500 renewal — and get access to all events.</p>
          {showJoin && (
            <Link to="/members/register" className="btn-primary">
              Register Now <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
