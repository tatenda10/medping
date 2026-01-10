import { Link } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-4 gap-4">
            <Link to="/" className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900 flex-shrink-0">
              <span className="text-2xl sm:text-3xl">💊</span>
              <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">
                MediPing
              </span>
            </Link>
            <nav className="hidden lg:flex gap-6 xl:gap-8 flex-1 justify-center">
              <a href="#features" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                Pricing
              </a>
              <Link to="/privacy-policy" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                Privacy
              </Link>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 text-sm font-medium transition-colors">
                Contact
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex gap-3">
                {/* Google Play Store Button - Small */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z" fill="#00D9FF"/>
                    <path d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z" fill="#00F0A8"/>
                    <path d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z" fill="#FFD23F"/>
                    <path d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" fill="#FF3A44"/>
                  </svg>
                  <span className="text-xs font-semibold hidden xl:inline">Play</span>
                </a>

                {/* Apple App Store Button - Small */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                  </svg>
                  <span className="text-xs font-semibold hidden xl:inline">App Store</span>
                </a>
              </div>
              {/* Mobile Menu Button */}
              <button className="lg:hidden w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-50 to-white py-20 flex-1">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6 tracking-tight">
                Never Miss a Dose Again
              </h1>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                MediPing helps you stay on track with your medication schedule. 
                Get reminders, track your doses, and manage your health with ease.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Google Play Store Button */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-3 bg-black text-white px-6 py-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z" fill="#00D9FF"/>
                    <path d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z" fill="#00F0A8"/>
                    <path d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z" fill="#FFD23F"/>
                    <path d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" fill="#FF3A44"/>
                  </svg>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-300 leading-tight">GET IT ON</span>
                    <span className="text-lg font-semibold leading-tight">Google Play</span>
                  </div>
                </a>

                {/* Apple App Store Button */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-3 bg-black text-white px-6 py-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                  </svg>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] text-gray-300 leading-tight">Download on the</span>
                    <span className="text-lg font-semibold leading-tight">App Store</span>
                  </div>
        </a>
      </div>
            </div>
            <div className="flex justify-center items-start gap-2 sm:gap-3 lg:gap-4 flex-nowrap w-full min-w-0 overflow-hidden">
              {/* Phone 1 - Dashboard */}
              <div className="relative w-[240px] sm:w-[280px] lg:w-80 h-[480px] sm:h-[560px] lg:h-[640px] bg-gray-900 rounded-[32px] sm:rounded-[40px] p-2 sm:p-3 shadow-2xl flex-shrink-0">
                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden flex flex-col">
                  {/* Status Bar */}
                  <div className="h-6 bg-gray-50 flex items-center justify-between px-4 text-[10px] text-gray-600">
                    <span>9:41</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                    </div>
                  </div>
                  
                  {/* App Header */}
                  <div className="bg-blue-600 px-4 py-3 text-white">
                    <div className="text-lg font-semibold">MediPing</div>
                    <div className="text-xs opacity-90 mt-1">Today, Dec 21</div>
                  </div>
                  
                  {/* App Content - Dashboard */}
                  <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
                    {/* Medication Card 1 */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white rounded-lg">
                        💊
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 mb-0.5 text-sm truncate">
                          Aspirin
                        </div>
                        <div className="text-xs text-gray-600">
                          8:00 AM
                        </div>
                      </div>
                      <div className="w-7 h-7 flex items-center justify-center bg-green-500 text-white rounded-full text-xs">
                        ✓
                      </div>
                    </div>
                    
                    {/* Medication Card 2 */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white rounded-lg">
                        💊
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 mb-0.5 text-sm truncate">
                          Vitamin D
                        </div>
                        <div className="text-xs text-gray-600">
                          12:00 PM
                        </div>
                      </div>
                      <div className="w-7 h-7 flex items-center justify-center bg-yellow-500 text-white rounded-full text-xs">
                        ⏰
                      </div>
                    </div>

                    {/* Medication Card 3 */}
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="text-2xl w-10 h-10 flex items-center justify-center bg-white rounded-lg">
                        💊
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 mb-0.5 text-sm truncate">
                          Metformin
                        </div>
                        <div className="text-xs text-gray-600">
                          8:00 PM
                        </div>
                      </div>
                      <div className="w-7 h-7 flex items-center justify-center bg-gray-300 text-gray-600 rounded-full text-xs">
                        ○
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="border-t border-gray-200 bg-white">
                    <div className="flex items-center justify-around py-2">
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-blue-600 rounded"></div>
                        <span className="text-[10px] text-blue-600 font-medium">Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded"></div>
                        <span className="text-[10px] text-gray-500">Calendar</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded"></div>
                        <span className="text-[10px] text-gray-500">Metrics</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                        <span className="text-[10px] text-gray-500">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone 2 - Calendar */}
              <div className="relative w-[240px] sm:w-[280px] lg:w-80 h-[480px] sm:h-[560px] lg:h-[640px] bg-gray-900 rounded-[32px] sm:rounded-[40px] p-2 sm:p-3 shadow-2xl flex-shrink-0">
                <div className="w-full h-full bg-white rounded-[32px] overflow-hidden flex flex-col">
                  {/* Status Bar */}
                  <div className="h-6 bg-gray-50 flex items-center justify-between px-4 text-[10px] text-gray-600">
                    <span>9:41</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                      <div className="w-4 h-2 bg-gray-400 rounded-sm"></div>
                    </div>
                  </div>
                  
                  {/* App Header */}
                  <div className="bg-blue-600 px-4 py-3 text-white">
                    <div className="text-lg font-semibold">Calendar</div>
                    <div className="text-xs opacity-90 mt-1">December 2025</div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="p-4 flex-1 flex flex-col">
                    {/* Calendar Days Header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <div key={i} className="text-center text-xs font-medium text-gray-600 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Dates */}
                    <div className="grid grid-cols-7 gap-1 flex-1">
                      {Array.from({ length: 35 }, (_, i) => {
                        const date = i - 6; // Start from Dec 15
                        const isToday = date === 21;
                        const hasMedication = [18, 19, 21, 22, 24].includes(date);
                        const isCurrentMonth = date > 0 && date <= 31;
                        
                        return (
                          <div
                            key={i}
                            className={`aspect-square flex flex-col items-center justify-center text-xs rounded-lg ${
                              isToday
                                ? 'bg-blue-600 text-white font-semibold'
                                : isCurrentMonth
                                ? 'text-gray-900'
                                : 'text-gray-300'
                            } ${hasMedication && isCurrentMonth ? 'bg-blue-50' : ''}`}
                          >
                            {isCurrentMonth && date > 0 ? date : ''}
                            {hasMedication && isCurrentMonth && (
                              <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Medications List */}
                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold text-gray-700 mb-2">Today's Medications</div>
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="text-lg">💊</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">Aspirin</div>
                          <div className="text-[10px] text-gray-600">8:00 AM</div>
                        </div>
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white">
                          ✓
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="text-lg">💊</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">Metformin</div>
                          <div className="text-[10px] text-gray-600">8:00 PM</div>
                        </div>
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation */}
                  <div className="border-t border-gray-200 bg-white">
                    <div className="flex items-center justify-around py-2">
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded"></div>
                        <span className="text-[10px] text-gray-500">Home</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-blue-600 rounded"></div>
                        <span className="text-[10px] text-blue-600 font-medium">Calendar</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded"></div>
                        <span className="text-[10px] text-gray-500">Metrics</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 py-1">
                        <div className="w-5 h-5 bg-gray-300 rounded-full"></div>
                        <span className="text-[10px] text-gray-500">Profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 lg:py-24 bg-white" id="features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Section */}
          <div className="text-center mb-16">
            <button className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>⚡</span>
              <span>Our Features</span>
            </button>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              We do it for the love of Health.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Streamline your medication management with our powerful features and gain insights with comprehensive health tracking metrics.
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {/* Feature 1 - Smart Reminders */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🔔</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Smart Reminders
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Never forget to take your medication with intelligent reminders that adapt to your schedule.
              </p>
            </div>

            {/* Feature 2 - Dose Tracking */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Dose Tracking
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Keep track of your medication history and monitor your adherence with detailed analytics.
              </p>
            </div>

            {/* Feature 3 - Caregiver Support */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Caregiver Support
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Share your medication schedule with family members or caregivers for better support.
              </p>
            </div>

            {/* Feature 4 - Calendar View */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Calendar View
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Visualize your medication schedule with an intuitive calendar interface.
              </p>
            </div>

            {/* Feature 5 - Health Analytics */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Health Analytics
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Gain insights with comprehensive medication adherence and health performance metrics.
              </p>
            </div>

            {/* Feature 6 - Medication Types */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">💊</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Medication Types
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Support for various medication forms including tablets, syrups, injections, and more.
              </p>
            </div>

            {/* Feature 7 - Offline Support */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Offline Support
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Access your medication schedule and track doses even without an internet connection.
              </p>
            </div>

            {/* Feature 8 - Custom Schedules */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⚙️</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Custom Schedules
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Create flexible medication schedules tailored to your specific needs and routine.
              </p>
            </div>
          </div>

          {/* Bottom Statement */}
          <p className="text-center text-gray-600 text-sm">
            MediPing offers comprehensive medication management solutions for individuals and families of all sizes.
          </p>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 sm:py-16 lg:py-24 bg-white" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top Section */}
          <div className="text-center mb-16">
            <button className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span>💰</span>
              <span>Pricing</span>
            </button>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that works best for you. All plans include core features to help you manage your medications.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:border-blue-500 transition-colors">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">$0</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Perfect for getting started</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Up to 3 medications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Smart reminders</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Dose tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Calendar view</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Basic analytics</span>
                </li>
              </ul>
              <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-medium transition-colors">
                Get Started
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white p-8 rounded-xl border-2 border-blue-500 hover:border-blue-600 transition-colors relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">$4.99</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">For serious medication management</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Unlimited medications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Advanced reminders</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Caregiver support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Detailed analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Export reports</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Priority support</span>
                </li>
              </ul>
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                Get Started
              </button>
            </div>

            {/* Family Plan */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 hover:border-blue-500 transition-colors">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Family</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">$9.99</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-sm text-gray-600 mt-2">For families and caregivers</p>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Everything in Pro</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Up to 5 family members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Shared medication schedules</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Family health dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">Multi-caregiver support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span className="text-gray-600 text-sm">24/7 priority support</span>
                </li>
              </ul>
              <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 px-6 py-3 rounded-lg font-medium transition-colors">
                Get Started
        </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white" id="contact">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Have questions or need support? We're here to help. Reach out to us and we'll get back to you as soon as possible.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Contact Information */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-lg">📧</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Email</p>
                    <a href="mailto:support@mediping.online" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                      support@mediping.online
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-lg">🌐</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Website</p>
                    <a href="https://mediping.online" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                      mediping.online
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 text-lg">⏰</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Response Time</p>
                    <p className="text-gray-600 text-sm">
                      We typically respond within 24-48 hours
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Send us a Message</h3>
              <form className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    placeholder="How can we help?"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows="4"
                    placeholder="Tell us more about your inquiry..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
                    required
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* App Store Section */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Download MediPing Today
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Get started with MediPing and never miss a dose again. Available on iOS and Android.
        </p>
      </div>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
            {/* Google Play Store Button */}
            <a 
              href="#" 
              className="inline-flex items-center gap-3 bg-black text-white px-6 py-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z" fill="#00D9FF"/>
                <path d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z" fill="#00F0A8"/>
                <path d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z" fill="#FFD23F"/>
                <path d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" fill="#FF3A44"/>
              </svg>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-gray-300 leading-tight">GET IT ON</span>
                <span className="text-lg font-semibold leading-tight">Google Play</span>
              </div>
            </a>

            {/* Apple App Store Button */}
            <a 
              href="#" 
              className="inline-flex items-center gap-3 bg-black text-white px-6 py-4 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
              </svg>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-gray-300 leading-tight">Download on the</span>
                <span className="text-lg font-semibold leading-tight">App Store</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 mb-6 sm:mb-8">
            {/* Brand Column */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-3xl">💊</span>
                <span className="text-2xl font-bold text-gray-900">MediPing</span>
              </div>
              <p className="text-gray-600 text-sm mb-6">
                Never miss a dose again. Manage your medications with ease.
              </p>
              {/* Social Media Icons */}
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                  <span className="text-white text-sm">f</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                  <span className="text-white text-sm">in</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                  <span className="text-white text-sm">@</span>
                </a>
                <a href="#" className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center hover:bg-gray-800 transition-colors">
                  <span className="text-white text-sm">📷</span>
                </a>
              </div>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="text-gray-900 font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#about" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    About Us
                  </a>
                </li>
                <li>
                  <Link to="/privacy-policy" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a href="#terms" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#cookie" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h3 className="text-gray-900 font-bold mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    How it Works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#contact" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#contact" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>

            {/* Download Now Column */}
            <div>
              <h3 className="text-gray-900 font-bold mb-4">Download Now</h3>
              <div className="space-y-3">
                {/* Apple App Store Button */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-lg hover:opacity-90 transition-opacity w-full"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                  </svg>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-gray-300 leading-tight">Download on the</span>
                    <span className="text-sm font-semibold leading-tight">App Store</span>
                  </div>
                </a>

                {/* Google Play Store Button */}
                <a 
                  href="#" 
                  className="inline-flex items-center gap-2 bg-black text-white px-4 py-3 rounded-lg hover:opacity-90 transition-opacity w-full"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5Z" fill="#00D9FF"/>
                    <path d="M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12Z" fill="#00F0A8"/>
                    <path d="M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81Z" fill="#FFD23F"/>
                    <path d="M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" fill="#FF3A44"/>
                  </svg>
                  <div className="flex flex-col items-start">
                    <span className="text-[9px] text-gray-300 leading-tight">GET IT ON</span>
                    <span className="text-sm font-semibold leading-tight">Google Play</span>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-gray-200 pt-6 mt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-600 text-sm">
                © Copyright All rights reserved. 2025
              </p>
              <div className="flex gap-6">
                <Link to="/privacy-policy" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                  Privacy & Policy
                </Link>
                <a href="#terms" className="text-gray-600 hover:text-blue-600 text-sm transition-colors">
                  Terms & Condition
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
