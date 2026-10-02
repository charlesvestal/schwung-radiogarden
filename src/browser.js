/*
 * browser.js — Radio Garden's station browser, as the module's FIRST PAGE.
 *
 * An `as_page` + `enterable` + `page_first` canvas (src/chain_params.json): the
 * page you land on is the browse list; click to enter it, jog and click through
 * continent > country > city > station, Back goes up a level and leaves at the
 * top; Shift+jog always leaves. It carries the root level's knobs (Gain,
 * Play/Pause, Stop), so they work here, in the chain editor and on the grid
 * page that follows.
 *
 * It is drawn as the HOST'S OWN LIST -- same rows, highlight, scrollbar and
 * brackets -- because anything else reads as a different widget. What is
 * playing is the patch name the host already shows in the header.
 *
 * What the host gives this page (schwung docs/CANVAS_PAGES.md; dr32's
 * resample.js is the other example):
 *   - un-entered, the jog pages past it and a click ENTERS. Entered, the jog
 *     and the click arrive here as CC 14 / CC 3, and Back asks handleBack
 *     (true = stay inside).
 *   - the ENTERING click is the host's and nothing reports it, so "entered" is
 *     inferred: any gesture that reaches onMidi proves it. A gap in draws means
 *     the page was off screen, and it resets to un-entered.
 *   - the host draws no brackets on a canvas page, so this draws them.
 *   - drawPage cannot read or write params, and there is no tick. So a city's
 *     stations load in the BACKGROUND (wget to a file) and drawPage polls for
 *     them: the UI no longer freezes while they load. [Random] is the
 *     exception -- it has to set the stream once the fetch lands, and only a
 *     hook can set a param -- so it fetches in the click, as the old
 *     full-screen UI always did.
 */

import * as std from 'std';
import * as os from 'os';

const CITIES = [
  /* -- Africa ------------------------------------------------------ */
  { continent: 'Africa', country: 'Algeria', city: 'Algiers' },
  { continent: 'Africa', country: 'Algeria', city: 'Annaba' },
  { continent: 'Africa', country: 'Algeria', city: 'Batna' },
  { continent: 'Africa', country: 'Algeria', city: 'Constantine' },
  { continent: 'Africa', country: 'Algeria', city: 'Oran' },
  { continent: 'Africa', country: 'Algeria', city: 'Setif' },
  { continent: 'Africa', country: 'Angola', city: 'Huambo' },
  { continent: 'Africa', country: 'Angola', city: 'Luanda' },
  { continent: 'Africa', country: 'Benin', city: 'Cotonou' },
  { continent: 'Africa', country: 'Botswana', city: 'Gaborone' },
  { continent: 'Africa', country: 'Burkina Faso', city: 'Ouagadougou' },
  { continent: 'Africa', country: 'Cameroon', city: 'Bamenda' },
  { continent: 'Africa', country: 'Cameroon', city: 'Douala' },
  { continent: 'Africa', country: 'Cameroon', city: 'Yaounde' },
  { continent: 'Africa', country: 'Cape Verde', city: 'Praia' },
  { continent: 'Africa', country: 'Central African Rep.', city: 'Bangui' },
  { continent: 'Africa', country: 'Chad', city: 'Ndjamena' },
  { continent: 'Africa', country: 'Comoros', city: 'Moroni' },
  { continent: 'Africa', country: 'Congo', city: 'Brazzaville' },
  { continent: 'Africa', country: 'DR Congo', city: 'Kinshasa' },
  { continent: 'Africa', country: 'DR Congo', city: 'Kisangani' },
  { continent: 'Africa', country: 'DR Congo', city: 'Lubumbashi' },
  { continent: 'Africa', country: 'DR Congo', city: 'Mbuji-Mayi' },
  { continent: 'Africa', country: 'Djibouti', city: 'Djibouti' },
  { continent: 'Africa', country: 'Egypt', city: 'Alexandria' },
  { continent: 'Africa', country: 'Egypt', city: 'Aswan' },
  { continent: 'Africa', country: 'Egypt', city: 'Cairo' },
  { continent: 'Africa', country: 'Egypt', city: 'Luxor' },
  { continent: 'Africa', country: 'Egypt', city: 'Mansoura' },
  { continent: 'Africa', country: 'Egypt', city: 'Port Said' },
  { continent: 'Africa', country: 'Egypt', city: 'Suez' },
  { continent: 'Africa', country: 'Eritrea', city: 'Asmara' },
  { continent: 'Africa', country: 'Eswatini', city: 'Mbabane' },
  { continent: 'Africa', country: 'Ethiopia', city: 'Addis Ababa' },
  { continent: 'Africa', country: 'Ethiopia', city: 'Bahir Dar' },
  { continent: 'Africa', country: 'Ethiopia', city: 'Dire Dawa' },
  { continent: 'Africa', country: 'Ethiopia', city: 'Hawassa' },
  { continent: 'Africa', country: 'Ethiopia', city: 'Mekelle' },
  { continent: 'Africa', country: 'Gabon', city: 'Libreville' },
  { continent: 'Africa', country: 'Gambia', city: 'Banjul' },
  { continent: 'Africa', country: 'Ghana', city: 'Accra' },
  { continent: 'Africa', country: 'Ghana', city: 'Cape Coast' },
  { continent: 'Africa', country: 'Ghana', city: 'Kumasi' },
  { continent: 'Africa', country: 'Ghana', city: 'Sekondi-Takoradi' },
  { continent: 'Africa', country: 'Ghana', city: 'Tamale' },
  { continent: 'Africa', country: 'Guinea', city: 'Conakry' },
  { continent: 'Africa', country: 'Ivory Coast', city: 'Abidjan' },
  { continent: 'Africa', country: 'Ivory Coast', city: 'Bouake' },
  { continent: 'Africa', country: 'Ivory Coast', city: 'Yamoussoukro' },
  { continent: 'Africa', country: 'Kenya', city: 'Eldoret' },
  { continent: 'Africa', country: 'Kenya', city: 'Kisumu' },
  { continent: 'Africa', country: 'Kenya', city: 'Mombasa' },
  { continent: 'Africa', country: 'Kenya', city: 'Nairobi' },
  { continent: 'Africa', country: 'Kenya', city: 'Nakuru' },
  { continent: 'Africa', country: 'Lesotho', city: 'Maseru' },
  { continent: 'Africa', country: 'Liberia', city: 'Monrovia' },
  { continent: 'Africa', country: 'Libya', city: 'Benghazi' },
  { continent: 'Africa', country: 'Libya', city: 'Tripoli' },
  { continent: 'Africa', country: 'Madagascar', city: 'Antananarivo' },
  { continent: 'Africa', country: 'Madagascar', city: 'Toamasina' },
  { continent: 'Africa', country: 'Malawi', city: 'Blantyre' },
  { continent: 'Africa', country: 'Malawi', city: 'Lilongwe' },
  { continent: 'Africa', country: 'Mali', city: 'Bamako' },
  { continent: 'Africa', country: 'Mali', city: 'Timbuktu' },
  { continent: 'Africa', country: 'Mauritania', city: 'Nouakchott' },
  { continent: 'Africa', country: 'Mauritius', city: 'Port Louis' },
  { continent: 'Africa', country: 'Morocco', city: 'Agadir' },
  { continent: 'Africa', country: 'Morocco', city: 'Casablanca' },
  { continent: 'Africa', country: 'Morocco', city: 'Fez' },
  { continent: 'Africa', country: 'Morocco', city: 'Marrakech' },
  { continent: 'Africa', country: 'Morocco', city: 'Meknes' },
  { continent: 'Africa', country: 'Morocco', city: 'Oujda' },
  { continent: 'Africa', country: 'Morocco', city: 'Rabat' },
  { continent: 'Africa', country: 'Morocco', city: 'Tangier' },
  { continent: 'Africa', country: 'Mozambique', city: 'Beira' },
  { continent: 'Africa', country: 'Mozambique', city: 'Maputo' },
  { continent: 'Africa', country: 'Mozambique', city: 'Nampula' },
  { continent: 'Africa', country: 'Namibia', city: 'Windhoek' },
  { continent: 'Africa', country: 'Niger', city: 'Niamey' },
  { continent: 'Africa', country: 'Nigeria', city: 'Abuja' },
  { continent: 'Africa', country: 'Nigeria', city: 'Benin City' },
  { continent: 'Africa', country: 'Nigeria', city: 'Calabar' },
  { continent: 'Africa', country: 'Nigeria', city: 'Enugu' },
  { continent: 'Africa', country: 'Nigeria', city: 'Ibadan' },
  { continent: 'Africa', country: 'Nigeria', city: 'Jos' },
  { continent: 'Africa', country: 'Nigeria', city: 'Kaduna' },
  { continent: 'Africa', country: 'Nigeria', city: 'Kano' },
  { continent: 'Africa', country: 'Nigeria', city: 'Lagos' },
  { continent: 'Africa', country: 'Nigeria', city: 'Maiduguri' },
  { continent: 'Africa', country: 'Nigeria', city: 'Port Harcourt' },
  { continent: 'Africa', country: 'Nigeria', city: 'Warri' },
  { continent: 'Africa', country: 'Reunion', city: 'Saint-Denis' },
  { continent: 'Africa', country: 'Rwanda', city: 'Kigali' },
  { continent: 'Africa', country: 'Senegal', city: 'Dakar' },
  { continent: 'Africa', country: 'Senegal', city: 'Saint-Louis' },
  { continent: 'Africa', country: 'Senegal', city: 'Thies' },
  { continent: 'Africa', country: 'Sierra Leone', city: 'Freetown' },
  { continent: 'Africa', country: 'Somalia', city: 'Mogadishu' },
  { continent: 'Africa', country: 'South Africa', city: 'Bloemfontein' },
  { continent: 'Africa', country: 'South Africa', city: 'Cape Town' },
  { continent: 'Africa', country: 'South Africa', city: 'Durban' },
  { continent: 'Africa', country: 'South Africa', city: 'East London' },
  { continent: 'Africa', country: 'South Africa', city: 'Johannesburg' },
  { continent: 'Africa', country: 'South Africa', city: 'Kimberley' },
  { continent: 'Africa', country: 'South Africa', city: 'Nelspruit' },
  { continent: 'Africa', country: 'South Africa', city: 'Pietermaritzburg' },
  { continent: 'Africa', country: 'South Africa', city: 'Port Elizabeth' },
  { continent: 'Africa', country: 'South Africa', city: 'Pretoria' },
  { continent: 'Africa', country: 'South Sudan', city: 'Juba' },
  { continent: 'Africa', country: 'Sudan', city: 'Khartoum' },
  { continent: 'Africa', country: 'Sudan', city: 'Omdurman' },
  { continent: 'Africa', country: 'Tanzania', city: 'Arusha' },
  { continent: 'Africa', country: 'Tanzania', city: 'Dar es Salaam' },
  { continent: 'Africa', country: 'Tanzania', city: 'Dodoma' },
  { continent: 'Africa', country: 'Tanzania', city: 'Mwanza' },
  { continent: 'Africa', country: 'Tanzania', city: 'Zanzibar' },
  { continent: 'Africa', country: 'Togo', city: 'Lome' },
  { continent: 'Africa', country: 'Tunisia', city: 'Sfax' },
  { continent: 'Africa', country: 'Tunisia', city: 'Tunis' },
  { continent: 'Africa', country: 'Uganda', city: 'Entebbe' },
  { continent: 'Africa', country: 'Uganda', city: 'Gulu' },
  { continent: 'Africa', country: 'Uganda', city: 'Jinja' },
  { continent: 'Africa', country: 'Uganda', city: 'Kampala' },
  { continent: 'Africa', country: 'Zambia', city: 'Kitwe' },
  { continent: 'Africa', country: 'Zambia', city: 'Livingstone' },
  { continent: 'Africa', country: 'Zambia', city: 'Lusaka' },
  { continent: 'Africa', country: 'Zambia', city: 'Ndola' },
  { continent: 'Africa', country: 'Zimbabwe', city: 'Bulawayo' },
  { continent: 'Africa', country: 'Zimbabwe', city: 'Harare' },

  /* -- Asia -------------------------------------------------------- */
  { continent: 'Asia', country: 'Afghanistan', city: 'Kabul' },
  { continent: 'Asia', country: 'Armenia', city: 'Yerevan' },
  { continent: 'Asia', country: 'Azerbaijan', city: 'Baku' },
  { continent: 'Asia', country: 'Bahrain', city: 'Manama' },
  { continent: 'Asia', country: 'Bangladesh', city: 'Chittagong' },
  { continent: 'Asia', country: 'Bangladesh', city: 'Dhaka' },
  { continent: 'Asia', country: 'Bangladesh', city: 'Khulna' },
  { continent: 'Asia', country: 'Bangladesh', city: 'Rajshahi' },
  { continent: 'Asia', country: 'Bangladesh', city: 'Sylhet' },
  { continent: 'Asia', country: 'Bhutan', city: 'Thimphu' },
  { continent: 'Asia', country: 'Brunei', city: 'Bandar Seri Begawan' },
  { continent: 'Asia', country: 'Cambodia', city: 'Phnom Penh' },
  { continent: 'Asia', country: 'Cambodia', city: 'Siem Reap' },
  { continent: 'Asia', country: 'China', city: 'Beijing' },
  { continent: 'Asia', country: 'China', city: 'Changsha' },
  { continent: 'Asia', country: 'China', city: 'Chengdu' },
  { continent: 'Asia', country: 'China', city: 'Chongqing' },
  { continent: 'Asia', country: 'China', city: 'Dalian' },
  { continent: 'Asia', country: 'China', city: 'Fuzhou' },
  { continent: 'Asia', country: 'China', city: 'Guangzhou' },
  { continent: 'Asia', country: 'China', city: 'Guiyang' },
  { continent: 'Asia', country: 'China', city: 'Hangzhou' },
  { continent: 'Asia', country: 'China', city: 'Harbin' },
  { continent: 'Asia', country: 'China', city: 'Hefei' },
  { continent: 'Asia', country: 'China', city: 'Jinan' },
  { continent: 'Asia', country: 'China', city: 'Kunming' },
  { continent: 'Asia', country: 'China', city: 'Lhasa' },
  { continent: 'Asia', country: 'China', city: 'Nanchang' },
  { continent: 'Asia', country: 'China', city: 'Nanjing' },
  { continent: 'Asia', country: 'China', city: 'Qingdao' },
  { continent: 'Asia', country: 'China', city: 'Shanghai' },
  { continent: 'Asia', country: 'China', city: 'Shenzhen' },
  { continent: 'Asia', country: 'China', city: 'Suzhou' },
  { continent: 'Asia', country: 'China', city: 'Tianjin' },
  { continent: 'Asia', country: 'China', city: 'Urumqi' },
  { continent: 'Asia', country: 'China', city: 'Wuhan' },
  { continent: 'Asia', country: 'China', city: 'Xiamen' },
  { continent: 'Asia', country: 'China', city: 'Xian' },
  { continent: 'Asia', country: 'China', city: 'Zhengzhou' },
  { continent: 'Asia', country: 'Georgia', city: 'Batumi' },
  { continent: 'Asia', country: 'Georgia', city: 'Tbilisi' },
  { continent: 'Asia', country: 'Hong Kong', city: 'Hong Kong' },
  { continent: 'Asia', country: 'India', city: 'Agra' },
  { continent: 'Asia', country: 'India', city: 'Ahmedabad' },
  { continent: 'Asia', country: 'India', city: 'Amritsar' },
  { continent: 'Asia', country: 'India', city: 'Bangalore' },
  { continent: 'Asia', country: 'India', city: 'Bhopal' },
  { continent: 'Asia', country: 'India', city: 'Chandigarh' },
  { continent: 'Asia', country: 'India', city: 'Chennai' },
  { continent: 'Asia', country: 'India', city: 'Coimbatore' },
  { continent: 'Asia', country: 'India', city: 'Dehradun' },
  { continent: 'Asia', country: 'India', city: 'Delhi' },
  { continent: 'Asia', country: 'India', city: 'Goa' },
  { continent: 'Asia', country: 'India', city: 'Guwahati' },
  { continent: 'Asia', country: 'India', city: 'Hyderabad' },
  { continent: 'Asia', country: 'India', city: 'Indore' },
  { continent: 'Asia', country: 'India', city: 'Jaipur' },
  { continent: 'Asia', country: 'India', city: 'Kochi' },
  { continent: 'Asia', country: 'India', city: 'Kolkata' },
  { continent: 'Asia', country: 'India', city: 'Lucknow' },
  { continent: 'Asia', country: 'India', city: 'Madurai' },
  { continent: 'Asia', country: 'India', city: 'Mangalore' },
  { continent: 'Asia', country: 'India', city: 'Mumbai' },
  { continent: 'Asia', country: 'India', city: 'Mysore' },
  { continent: 'Asia', country: 'India', city: 'Nagpur' },
  { continent: 'Asia', country: 'India', city: 'Patna' },
  { continent: 'Asia', country: 'India', city: 'Pondicherry' },
  { continent: 'Asia', country: 'India', city: 'Pune' },
  { continent: 'Asia', country: 'India', city: 'Raipur' },
  { continent: 'Asia', country: 'India', city: 'Ranchi' },
  { continent: 'Asia', country: 'India', city: 'Shimla' },
  { continent: 'Asia', country: 'India', city: 'Surat' },
  { continent: 'Asia', country: 'India', city: 'Udaipur' },
  { continent: 'Asia', country: 'India', city: 'Varanasi' },
  { continent: 'Asia', country: 'India', city: 'Visakhapatnam' },
  { continent: 'Asia', country: 'Indonesia', city: 'Bali' },
  { continent: 'Asia', country: 'Indonesia', city: 'Balikpapan' },
  { continent: 'Asia', country: 'Indonesia', city: 'Bandung' },
  { continent: 'Asia', country: 'Indonesia', city: 'Denpasar' },
  { continent: 'Asia', country: 'Indonesia', city: 'Jakarta' },
  { continent: 'Asia', country: 'Indonesia', city: 'Makassar' },
  { continent: 'Asia', country: 'Indonesia', city: 'Manado' },
  { continent: 'Asia', country: 'Indonesia', city: 'Medan' },
  { continent: 'Asia', country: 'Indonesia', city: 'Palembang' },
  { continent: 'Asia', country: 'Indonesia', city: 'Pontianak' },
  { continent: 'Asia', country: 'Indonesia', city: 'Semarang' },
  { continent: 'Asia', country: 'Indonesia', city: 'Surabaya' },
  { continent: 'Asia', country: 'Indonesia', city: 'Yogyakarta' },
  { continent: 'Asia', country: 'Iran', city: 'Ahvaz' },
  { continent: 'Asia', country: 'Iran', city: 'Isfahan' },
  { continent: 'Asia', country: 'Iran', city: 'Kerman' },
  { continent: 'Asia', country: 'Iran', city: 'Mashhad' },
  { continent: 'Asia', country: 'Iran', city: 'Rasht' },
  { continent: 'Asia', country: 'Iran', city: 'Shiraz' },
  { continent: 'Asia', country: 'Iran', city: 'Tabriz' },
  { continent: 'Asia', country: 'Iran', city: 'Tehran' },
  { continent: 'Asia', country: 'Iraq', city: 'Baghdad' },
  { continent: 'Asia', country: 'Iraq', city: 'Basra' },
  { continent: 'Asia', country: 'Iraq', city: 'Erbil' },
  { continent: 'Asia', country: 'Iraq', city: 'Mosul' },
  { continent: 'Asia', country: 'Iraq', city: 'Sulaymaniyah' },
  { continent: 'Asia', country: 'Israel', city: 'Haifa' },
  { continent: 'Asia', country: 'Israel', city: 'Jerusalem' },
  { continent: 'Asia', country: 'Israel', city: 'Tel Aviv' },
  { continent: 'Asia', country: 'Japan', city: 'Fukuoka' },
  { continent: 'Asia', country: 'Japan', city: 'Hamamatsu' },
  { continent: 'Asia', country: 'Japan', city: 'Hiroshima' },
  { continent: 'Asia', country: 'Japan', city: 'Kagoshima' },
  { continent: 'Asia', country: 'Japan', city: 'Kanazawa' },
  { continent: 'Asia', country: 'Japan', city: 'Kobe' },
  { continent: 'Asia', country: 'Japan', city: 'Kumamoto' },
  { continent: 'Asia', country: 'Japan', city: 'Kyoto' },
  { continent: 'Asia', country: 'Japan', city: 'Matsuyama' },
  { continent: 'Asia', country: 'Japan', city: 'Nagasaki' },
  { continent: 'Asia', country: 'Japan', city: 'Nagoya' },
  { continent: 'Asia', country: 'Japan', city: 'Nara' },
  { continent: 'Asia', country: 'Japan', city: 'Niigata' },
  { continent: 'Asia', country: 'Japan', city: 'Okayama' },
  { continent: 'Asia', country: 'Japan', city: 'Okinawa' },
  { continent: 'Asia', country: 'Japan', city: 'Osaka' },
  { continent: 'Asia', country: 'Japan', city: 'Sapporo' },
  { continent: 'Asia', country: 'Japan', city: 'Sendai' },
  { continent: 'Asia', country: 'Japan', city: 'Tokyo' },
  { continent: 'Asia', country: 'Japan', city: 'Yokohama' },
  { continent: 'Asia', country: 'Jordan', city: 'Amman' },
  { continent: 'Asia', country: 'Kazakhstan', city: 'Almaty' },
  { continent: 'Asia', country: 'Kazakhstan', city: 'Astana' },
  { continent: 'Asia', country: 'Kuwait', city: 'Kuwait City' },
  { continent: 'Asia', country: 'Kyrgyzstan', city: 'Bishkek' },
  { continent: 'Asia', country: 'Laos', city: 'Vientiane' },
  { continent: 'Asia', country: 'Lebanon', city: 'Beirut' },
  { continent: 'Asia', country: 'Macau', city: 'Macau' },
  { continent: 'Asia', country: 'Malaysia', city: 'Ipoh' },
  { continent: 'Asia', country: 'Malaysia', city: 'Johor Bahru' },
  { continent: 'Asia', country: 'Malaysia', city: 'Kota Kinabalu' },
  { continent: 'Asia', country: 'Malaysia', city: 'Kuala Lumpur' },
  { continent: 'Asia', country: 'Malaysia', city: 'Kuching' },
  { continent: 'Asia', country: 'Malaysia', city: 'Malacca' },
  { continent: 'Asia', country: 'Malaysia', city: 'Penang' },
  { continent: 'Asia', country: 'Maldives', city: 'Male' },
  { continent: 'Asia', country: 'Mongolia', city: 'Ulaanbaatar' },
  { continent: 'Asia', country: 'Myanmar', city: 'Mandalay' },
  { continent: 'Asia', country: 'Myanmar', city: 'Yangon' },
  { continent: 'Asia', country: 'Nepal', city: 'Kathmandu' },
  { continent: 'Asia', country: 'Nepal', city: 'Pokhara' },
  { continent: 'Asia', country: 'North Korea', city: 'Pyongyang' },
  { continent: 'Asia', country: 'Oman', city: 'Muscat' },
  { continent: 'Asia', country: 'Pakistan', city: 'Faisalabad' },
  { continent: 'Asia', country: 'Pakistan', city: 'Islamabad' },
  { continent: 'Asia', country: 'Pakistan', city: 'Karachi' },
  { continent: 'Asia', country: 'Pakistan', city: 'Lahore' },
  { continent: 'Asia', country: 'Pakistan', city: 'Multan' },
  { continent: 'Asia', country: 'Pakistan', city: 'Peshawar' },
  { continent: 'Asia', country: 'Pakistan', city: 'Quetta' },
  { continent: 'Asia', country: 'Pakistan', city: 'Rawalpindi' },
  { continent: 'Asia', country: 'Palestine', city: 'Ramallah' },
  { continent: 'Asia', country: 'Philippines', city: 'Baguio' },
  { continent: 'Asia', country: 'Philippines', city: 'Cebu' },
  { continent: 'Asia', country: 'Philippines', city: 'Davao' },
  { continent: 'Asia', country: 'Philippines', city: 'Iloilo' },
  { continent: 'Asia', country: 'Philippines', city: 'Makati' },
  { continent: 'Asia', country: 'Philippines', city: 'Manila' },
  { continent: 'Asia', country: 'Philippines', city: 'Quezon City' },
  { continent: 'Asia', country: 'Qatar', city: 'Doha' },
  { continent: 'Asia', country: 'Saudi Arabia', city: 'Dammam' },
  { continent: 'Asia', country: 'Saudi Arabia', city: 'Jeddah' },
  { continent: 'Asia', country: 'Saudi Arabia', city: 'Mecca' },
  { continent: 'Asia', country: 'Saudi Arabia', city: 'Medina' },
  { continent: 'Asia', country: 'Saudi Arabia', city: 'Riyadh' },
  { continent: 'Asia', country: 'Singapore', city: 'Singapore' },
  { continent: 'Asia', country: 'South Korea', city: 'Busan' },
  { continent: 'Asia', country: 'South Korea', city: 'Daegu' },
  { continent: 'Asia', country: 'South Korea', city: 'Daejeon' },
  { continent: 'Asia', country: 'South Korea', city: 'Gwangju' },
  { continent: 'Asia', country: 'South Korea', city: 'Incheon' },
  { continent: 'Asia', country: 'South Korea', city: 'Jeju' },
  { continent: 'Asia', country: 'South Korea', city: 'Seoul' },
  { continent: 'Asia', country: 'South Korea', city: 'Suwon' },
  { continent: 'Asia', country: 'South Korea', city: 'Ulsan' },
  { continent: 'Asia', country: 'Sri Lanka', city: 'Colombo' },
  { continent: 'Asia', country: 'Sri Lanka', city: 'Galle' },
  { continent: 'Asia', country: 'Sri Lanka', city: 'Jaffna' },
  { continent: 'Asia', country: 'Sri Lanka', city: 'Kandy' },
  { continent: 'Asia', country: 'Syria', city: 'Damascus' },
  { continent: 'Asia', country: 'Taiwan', city: 'Hsinchu' },
  { continent: 'Asia', country: 'Taiwan', city: 'Kaohsiung' },
  { continent: 'Asia', country: 'Taiwan', city: 'Taichung' },
  { continent: 'Asia', country: 'Taiwan', city: 'Tainan' },
  { continent: 'Asia', country: 'Taiwan', city: 'Taipei' },
  { continent: 'Asia', country: 'Tajikistan', city: 'Dushanbe' },
  { continent: 'Asia', country: 'Thailand', city: 'Bangkok' },
  { continent: 'Asia', country: 'Thailand', city: 'Chiang Mai' },
  { continent: 'Asia', country: 'Thailand', city: 'Chiang Rai' },
  { continent: 'Asia', country: 'Thailand', city: 'Hat Yai' },
  { continent: 'Asia', country: 'Thailand', city: 'Khon Kaen' },
  { continent: 'Asia', country: 'Thailand', city: 'Nakhon Ratchasima' },
  { continent: 'Asia', country: 'Thailand', city: 'Pattaya' },
  { continent: 'Asia', country: 'Thailand', city: 'Phuket' },
  { continent: 'Asia', country: 'Thailand', city: 'Udon Thani' },
  { continent: 'Asia', country: 'Timor-Leste', city: 'Dili' },
  { continent: 'Asia', country: 'Turkey', city: 'Adana' },
  { continent: 'Asia', country: 'Turkey', city: 'Ankara' },
  { continent: 'Asia', country: 'Turkey', city: 'Antalya' },
  { continent: 'Asia', country: 'Turkey', city: 'Bursa' },
  { continent: 'Asia', country: 'Turkey', city: 'Diyarbakir' },
  { continent: 'Asia', country: 'Turkey', city: 'Eskisehir' },
  { continent: 'Asia', country: 'Turkey', city: 'Gaziantep' },
  { continent: 'Asia', country: 'Turkey', city: 'Istanbul' },
  { continent: 'Asia', country: 'Turkey', city: 'Izmir' },
  { continent: 'Asia', country: 'Turkey', city: 'Kayseri' },
  { continent: 'Asia', country: 'Turkey', city: 'Konya' },
  { continent: 'Asia', country: 'Turkey', city: 'Mersin' },
  { continent: 'Asia', country: 'Turkey', city: 'Trabzon' },
  { continent: 'Asia', country: 'Turkmenistan', city: 'Ashgabat' },
  { continent: 'Asia', country: 'UAE', city: 'Abu Dhabi' },
  { continent: 'Asia', country: 'UAE', city: 'Dubai' },
  { continent: 'Asia', country: 'UAE', city: 'Sharjah' },
  { continent: 'Asia', country: 'Uzbekistan', city: 'Bukhara' },
  { continent: 'Asia', country: 'Uzbekistan', city: 'Samarkand' },
  { continent: 'Asia', country: 'Uzbekistan', city: 'Tashkent' },
  { continent: 'Asia', country: 'Vietnam', city: 'Can Tho' },
  { continent: 'Asia', country: 'Vietnam', city: 'Da Nang' },
  { continent: 'Asia', country: 'Vietnam', city: 'Dalat' },
  { continent: 'Asia', country: 'Vietnam', city: 'Hai Phong' },
  { continent: 'Asia', country: 'Vietnam', city: 'Hanoi' },
  { continent: 'Asia', country: 'Vietnam', city: 'Ho Chi Minh City' },
  { continent: 'Asia', country: 'Vietnam', city: 'Hue' },
  { continent: 'Asia', country: 'Vietnam', city: 'Nha Trang' },
  { continent: 'Asia', country: 'Yemen', city: 'Sanaa' },

  /* -- Europe ------------------------------------------------------ */
  { continent: 'Europe', country: 'Albania', city: 'Tirana' },
  { continent: 'Europe', country: 'Andorra', city: 'Andorra la Vella' },
  { continent: 'Europe', country: 'Austria', city: 'Graz' },
  { continent: 'Europe', country: 'Austria', city: 'Innsbruck' },
  { continent: 'Europe', country: 'Austria', city: 'Klagenfurt' },
  { continent: 'Europe', country: 'Austria', city: 'Linz' },
  { continent: 'Europe', country: 'Austria', city: 'Salzburg' },
  { continent: 'Europe', country: 'Austria', city: 'Vienna' },
  { continent: 'Europe', country: 'Belarus', city: 'Minsk' },
  { continent: 'Europe', country: 'Belgium', city: 'Antwerp' },
  { continent: 'Europe', country: 'Belgium', city: 'Bruges' },
  { continent: 'Europe', country: 'Belgium', city: 'Brussels' },
  { continent: 'Europe', country: 'Belgium', city: 'Ghent' },
  { continent: 'Europe', country: 'Belgium', city: 'Liege' },
  { continent: 'Europe', country: 'Bosnia', city: 'Mostar' },
  { continent: 'Europe', country: 'Bosnia', city: 'Sarajevo' },
  { continent: 'Europe', country: 'Bulgaria', city: 'Burgas' },
  { continent: 'Europe', country: 'Bulgaria', city: 'Plovdiv' },
  { continent: 'Europe', country: 'Bulgaria', city: 'Sofia' },
  { continent: 'Europe', country: 'Bulgaria', city: 'Stara Zagora' },
  { continent: 'Europe', country: 'Bulgaria', city: 'Varna' },
  { continent: 'Europe', country: 'Croatia', city: 'Dubrovnik' },
  { continent: 'Europe', country: 'Croatia', city: 'Pula' },
  { continent: 'Europe', country: 'Croatia', city: 'Rijeka' },
  { continent: 'Europe', country: 'Croatia', city: 'Split' },
  { continent: 'Europe', country: 'Croatia', city: 'Zadar' },
  { continent: 'Europe', country: 'Croatia', city: 'Zagreb' },
  { continent: 'Europe', country: 'Cyprus', city: 'Limassol' },
  { continent: 'Europe', country: 'Cyprus', city: 'Nicosia' },
  { continent: 'Europe', country: 'Czech Republic', city: 'Brno' },
  { continent: 'Europe', country: 'Czech Republic', city: 'Olomouc' },
  { continent: 'Europe', country: 'Czech Republic', city: 'Ostrava' },
  { continent: 'Europe', country: 'Czech Republic', city: 'Plzen' },
  { continent: 'Europe', country: 'Czech Republic', city: 'Prague' },
  { continent: 'Europe', country: 'Denmark', city: 'Aalborg' },
  { continent: 'Europe', country: 'Denmark', city: 'Aarhus' },
  { continent: 'Europe', country: 'Denmark', city: 'Copenhagen' },
  { continent: 'Europe', country: 'Denmark', city: 'Odense' },
  { continent: 'Europe', country: 'Estonia', city: 'Tallinn' },
  { continent: 'Europe', country: 'Estonia', city: 'Tartu' },
  { continent: 'Europe', country: 'Finland', city: 'Helsinki' },
  { continent: 'Europe', country: 'Finland', city: 'Jyvaskyla' },
  { continent: 'Europe', country: 'Finland', city: 'Lahti' },
  { continent: 'Europe', country: 'Finland', city: 'Oulu' },
  { continent: 'Europe', country: 'Finland', city: 'Rovaniemi' },
  { continent: 'Europe', country: 'Finland', city: 'Tampere' },
  { continent: 'Europe', country: 'Finland', city: 'Turku' },
  { continent: 'Europe', country: 'France', city: 'Aix-en-Provence' },
  { continent: 'Europe', country: 'France', city: 'Ajaccio' },
  { continent: 'Europe', country: 'France', city: 'Avignon' },
  { continent: 'Europe', country: 'France', city: 'Bordeaux' },
  { continent: 'Europe', country: 'France', city: 'Brest' },
  { continent: 'Europe', country: 'France', city: 'Caen' },
  { continent: 'Europe', country: 'France', city: 'Clermont-Ferrand' },
  { continent: 'Europe', country: 'France', city: 'Dijon' },
  { continent: 'Europe', country: 'France', city: 'Grenoble' },
  { continent: 'Europe', country: 'France', city: 'Le Havre' },
  { continent: 'Europe', country: 'France', city: 'Lille' },
  { continent: 'Europe', country: 'France', city: 'Lyon' },
  { continent: 'Europe', country: 'France', city: 'Marseille' },
  { continent: 'Europe', country: 'France', city: 'Montpellier' },
  { continent: 'Europe', country: 'France', city: 'Nantes' },
  { continent: 'Europe', country: 'France', city: 'Nice' },
  { continent: 'Europe', country: 'France', city: 'Paris' },
  { continent: 'Europe', country: 'France', city: 'Perpignan' },
  { continent: 'Europe', country: 'France', city: 'Reims' },
  { continent: 'Europe', country: 'France', city: 'Rennes' },
  { continent: 'Europe', country: 'France', city: 'Rouen' },
  { continent: 'Europe', country: 'France', city: 'Strasbourg' },
  { continent: 'Europe', country: 'France', city: 'Toulouse' },
  { continent: 'Europe', country: 'France', city: 'Tours' },
  { continent: 'Europe', country: 'Germany', city: 'Aachen' },
  { continent: 'Europe', country: 'Germany', city: 'Augsburg' },
  { continent: 'Europe', country: 'Germany', city: 'Berlin' },
  { continent: 'Europe', country: 'Germany', city: 'Bonn' },
  { continent: 'Europe', country: 'Germany', city: 'Bremen' },
  { continent: 'Europe', country: 'Germany', city: 'Cologne' },
  { continent: 'Europe', country: 'Germany', city: 'Dortmund' },
  { continent: 'Europe', country: 'Germany', city: 'Dresden' },
  { continent: 'Europe', country: 'Germany', city: 'Duisburg' },
  { continent: 'Europe', country: 'Germany', city: 'Dusseldorf' },
  { continent: 'Europe', country: 'Germany', city: 'Erfurt' },
  { continent: 'Europe', country: 'Germany', city: 'Essen' },
  { continent: 'Europe', country: 'Germany', city: 'Frankfurt' },
  { continent: 'Europe', country: 'Germany', city: 'Freiburg' },
  { continent: 'Europe', country: 'Germany', city: 'Hamburg' },
  { continent: 'Europe', country: 'Germany', city: 'Hannover' },
  { continent: 'Europe', country: 'Germany', city: 'Heidelberg' },
  { continent: 'Europe', country: 'Germany', city: 'Kassel' },
  { continent: 'Europe', country: 'Germany', city: 'Kiel' },
  { continent: 'Europe', country: 'Germany', city: 'Leipzig' },
  { continent: 'Europe', country: 'Germany', city: 'Lubeck' },
  { continent: 'Europe', country: 'Germany', city: 'Mainz' },
  { continent: 'Europe', country: 'Germany', city: 'Mannheim' },
  { continent: 'Europe', country: 'Germany', city: 'Munich' },
  { continent: 'Europe', country: 'Germany', city: 'Nuremberg' },
  { continent: 'Europe', country: 'Germany', city: 'Potsdam' },
  { continent: 'Europe', country: 'Germany', city: 'Regensburg' },
  { continent: 'Europe', country: 'Germany', city: 'Rostock' },
  { continent: 'Europe', country: 'Germany', city: 'Stuttgart' },
  { continent: 'Europe', country: 'Germany', city: 'Trier' },
  { continent: 'Europe', country: 'Germany', city: 'Weimar' },
  { continent: 'Europe', country: 'Germany', city: 'Wiesbaden' },
  { continent: 'Europe', country: 'Germany', city: 'Wurzburg' },
  { continent: 'Europe', country: 'Greece', city: 'Athens' },
  { continent: 'Europe', country: 'Greece', city: 'Chania' },
  { continent: 'Europe', country: 'Greece', city: 'Corfu' },
  { continent: 'Europe', country: 'Greece', city: 'Heraklion' },
  { continent: 'Europe', country: 'Greece', city: 'Ioannina' },
  { continent: 'Europe', country: 'Greece', city: 'Patras' },
  { continent: 'Europe', country: 'Greece', city: 'Rhodes' },
  { continent: 'Europe', country: 'Greece', city: 'Thessaloniki' },
  { continent: 'Europe', country: 'Greece', city: 'Volos' },
  { continent: 'Europe', country: 'Hungary', city: 'Budapest' },
  { continent: 'Europe', country: 'Hungary', city: 'Debrecen' },
  { continent: 'Europe', country: 'Hungary', city: 'Miskolc' },
  { continent: 'Europe', country: 'Hungary', city: 'Pecs' },
  { continent: 'Europe', country: 'Hungary', city: 'Szeged' },
  { continent: 'Europe', country: 'Iceland', city: 'Reykjavik' },
  { continent: 'Europe', country: 'Ireland', city: 'Cork' },
  { continent: 'Europe', country: 'Ireland', city: 'Dublin' },
  { continent: 'Europe', country: 'Ireland', city: 'Galway' },
  { continent: 'Europe', country: 'Ireland', city: 'Killarney' },
  { continent: 'Europe', country: 'Ireland', city: 'Limerick' },
  { continent: 'Europe', country: 'Ireland', city: 'Waterford' },
  { continent: 'Europe', country: 'Italy', city: 'Bari' },
  { continent: 'Europe', country: 'Italy', city: 'Bergamo' },
  { continent: 'Europe', country: 'Italy', city: 'Bologna' },
  { continent: 'Europe', country: 'Italy', city: 'Brescia' },
  { continent: 'Europe', country: 'Italy', city: 'Cagliari' },
  { continent: 'Europe', country: 'Italy', city: 'Catania' },
  { continent: 'Europe', country: 'Italy', city: 'Florence' },
  { continent: 'Europe', country: 'Italy', city: 'Genoa' },
  { continent: 'Europe', country: 'Italy', city: 'Lecce' },
  { continent: 'Europe', country: 'Italy', city: 'Milan' },
  { continent: 'Europe', country: 'Italy', city: 'Naples' },
  { continent: 'Europe', country: 'Italy', city: 'Padua' },
  { continent: 'Europe', country: 'Italy', city: 'Palermo' },
  { continent: 'Europe', country: 'Italy', city: 'Parma' },
  { continent: 'Europe', country: 'Italy', city: 'Perugia' },
  { continent: 'Europe', country: 'Italy', city: 'Pisa' },
  { continent: 'Europe', country: 'Italy', city: 'Rome' },
  { continent: 'Europe', country: 'Italy', city: 'Siena' },
  { continent: 'Europe', country: 'Italy', city: 'Trieste' },
  { continent: 'Europe', country: 'Italy', city: 'Turin' },
  { continent: 'Europe', country: 'Italy', city: 'Venice' },
  { continent: 'Europe', country: 'Italy', city: 'Verona' },
  { continent: 'Europe', country: 'Kosovo', city: 'Pristina' },
  { continent: 'Europe', country: 'Latvia', city: 'Daugavpils' },
  { continent: 'Europe', country: 'Latvia', city: 'Riga' },
  { continent: 'Europe', country: 'Lithuania', city: 'Kaunas' },
  { continent: 'Europe', country: 'Lithuania', city: 'Vilnius' },
  { continent: 'Europe', country: 'Luxembourg', city: 'Luxembourg' },
  { continent: 'Europe', country: 'Malta', city: 'Valletta' },
  { continent: 'Europe', country: 'Moldova', city: 'Chisinau' },
  { continent: 'Europe', country: 'Monaco', city: 'Monaco' },
  { continent: 'Europe', country: 'Montenegro', city: 'Budva' },
  { continent: 'Europe', country: 'Montenegro', city: 'Podgorica' },
  { continent: 'Europe', country: 'Netherlands', city: 'Amsterdam' },
  { continent: 'Europe', country: 'Netherlands', city: 'Delft' },
  { continent: 'Europe', country: 'Netherlands', city: 'Eindhoven' },
  { continent: 'Europe', country: 'Netherlands', city: 'Groningen' },
  { continent: 'Europe', country: 'Netherlands', city: 'Haarlem' },
  { continent: 'Europe', country: 'Netherlands', city: 'Leiden' },
  { continent: 'Europe', country: 'Netherlands', city: 'Maastricht' },
  { continent: 'Europe', country: 'Netherlands', city: 'Rotterdam' },
  { continent: 'Europe', country: 'Netherlands', city: 'The Hague' },
  { continent: 'Europe', country: 'Netherlands', city: 'Utrecht' },
  { continent: 'Europe', country: 'North Macedonia', city: 'Skopje' },
  { continent: 'Europe', country: 'Norway', city: 'Bergen' },
  { continent: 'Europe', country: 'Norway', city: 'Bodo' },
  { continent: 'Europe', country: 'Norway', city: 'Kristiansand' },
  { continent: 'Europe', country: 'Norway', city: 'Oslo' },
  { continent: 'Europe', country: 'Norway', city: 'Stavanger' },
  { continent: 'Europe', country: 'Norway', city: 'Tromso' },
  { continent: 'Europe', country: 'Norway', city: 'Trondheim' },
  { continent: 'Europe', country: 'Poland', city: 'Bialystok' },
  { continent: 'Europe', country: 'Poland', city: 'Bydgoszcz' },
  { continent: 'Europe', country: 'Poland', city: 'Gdansk' },
  { continent: 'Europe', country: 'Poland', city: 'Katowice' },
  { continent: 'Europe', country: 'Poland', city: 'Krakow' },
  { continent: 'Europe', country: 'Poland', city: 'Lodz' },
  { continent: 'Europe', country: 'Poland', city: 'Lublin' },
  { continent: 'Europe', country: 'Poland', city: 'Poznan' },
  { continent: 'Europe', country: 'Poland', city: 'Szczecin' },
  { continent: 'Europe', country: 'Poland', city: 'Torun' },
  { continent: 'Europe', country: 'Poland', city: 'Warsaw' },
  { continent: 'Europe', country: 'Poland', city: 'Wroclaw' },
  { continent: 'Europe', country: 'Portugal', city: 'Aveiro' },
  { continent: 'Europe', country: 'Portugal', city: 'Braga' },
  { continent: 'Europe', country: 'Portugal', city: 'Coimbra' },
  { continent: 'Europe', country: 'Portugal', city: 'Faro' },
  { continent: 'Europe', country: 'Portugal', city: 'Funchal' },
  { continent: 'Europe', country: 'Portugal', city: 'Lisbon' },
  { continent: 'Europe', country: 'Portugal', city: 'Porto' },
  { continent: 'Europe', country: 'Romania', city: 'Brasov' },
  { continent: 'Europe', country: 'Romania', city: 'Bucharest' },
  { continent: 'Europe', country: 'Romania', city: 'Cluj-Napoca' },
  { continent: 'Europe', country: 'Romania', city: 'Constanta' },
  { continent: 'Europe', country: 'Romania', city: 'Craiova' },
  { continent: 'Europe', country: 'Romania', city: 'Iasi' },
  { continent: 'Europe', country: 'Romania', city: 'Sibiu' },
  { continent: 'Europe', country: 'Romania', city: 'Timisoara' },
  { continent: 'Europe', country: 'Russia', city: 'Chelyabinsk' },
  { continent: 'Europe', country: 'Russia', city: 'Irkutsk' },
  { continent: 'Europe', country: 'Russia', city: 'Kaliningrad' },
  { continent: 'Europe', country: 'Russia', city: 'Kazan' },
  { continent: 'Europe', country: 'Russia', city: 'Krasnodar' },
  { continent: 'Europe', country: 'Russia', city: 'Krasnoyarsk' },
  { continent: 'Europe', country: 'Russia', city: 'Moscow' },
  { continent: 'Europe', country: 'Russia', city: 'Nizhny Novgorod' },
  { continent: 'Europe', country: 'Russia', city: 'Novosibirsk' },
  { continent: 'Europe', country: 'Russia', city: 'Omsk' },
  { continent: 'Europe', country: 'Russia', city: 'Perm' },
  { continent: 'Europe', country: 'Russia', city: 'Rostov-on-Don' },
  { continent: 'Europe', country: 'Russia', city: 'Samara' },
  { continent: 'Europe', country: 'Russia', city: 'Sochi' },
  { continent: 'Europe', country: 'Russia', city: 'St Petersburg' },
  { continent: 'Europe', country: 'Russia', city: 'Ufa' },
  { continent: 'Europe', country: 'Russia', city: 'Vladivostok' },
  { continent: 'Europe', country: 'Russia', city: 'Volgograd' },
  { continent: 'Europe', country: 'Russia', city: 'Voronezh' },
  { continent: 'Europe', country: 'Russia', city: 'Yekaterinburg' },
  { continent: 'Europe', country: 'Serbia', city: 'Belgrade' },
  { continent: 'Europe', country: 'Serbia', city: 'Kragujevac' },
  { continent: 'Europe', country: 'Serbia', city: 'Nis' },
  { continent: 'Europe', country: 'Serbia', city: 'Novi Sad' },
  { continent: 'Europe', country: 'Serbia', city: 'Subotica' },
  { continent: 'Europe', country: 'Slovakia', city: 'Bratislava' },
  { continent: 'Europe', country: 'Slovakia', city: 'Kosice' },
  { continent: 'Europe', country: 'Slovenia', city: 'Ljubljana' },
  { continent: 'Europe', country: 'Slovenia', city: 'Maribor' },
  { continent: 'Europe', country: 'Spain', city: 'Alicante' },
  { continent: 'Europe', country: 'Spain', city: 'Barcelona' },
  { continent: 'Europe', country: 'Spain', city: 'Bilbao' },
  { continent: 'Europe', country: 'Spain', city: 'Cadiz' },
  { continent: 'Europe', country: 'Spain', city: 'Cordoba' },
  { continent: 'Europe', country: 'Spain', city: 'Granada' },
  { continent: 'Europe', country: 'Spain', city: 'Ibiza' },
  { continent: 'Europe', country: 'Spain', city: 'Las Palmas' },
  { continent: 'Europe', country: 'Spain', city: 'Madrid' },
  { continent: 'Europe', country: 'Spain', city: 'Malaga' },
  { continent: 'Europe', country: 'Spain', city: 'Murcia' },
  { continent: 'Europe', country: 'Spain', city: 'Palma de Mallorca' },
  { continent: 'Europe', country: 'Spain', city: 'Pamplona' },
  { continent: 'Europe', country: 'Spain', city: 'Salamanca' },
  { continent: 'Europe', country: 'Spain', city: 'San Sebastian' },
  { continent: 'Europe', country: 'Spain', city: 'Santander' },
  { continent: 'Europe', country: 'Spain', city: 'Seville' },
  { continent: 'Europe', country: 'Spain', city: 'Tenerife' },
  { continent: 'Europe', country: 'Spain', city: 'Valencia' },
  { continent: 'Europe', country: 'Spain', city: 'Valladolid' },
  { continent: 'Europe', country: 'Spain', city: 'Vigo' },
  { continent: 'Europe', country: 'Spain', city: 'Zaragoza' },
  { continent: 'Europe', country: 'Sweden', city: 'Gothenburg' },
  { continent: 'Europe', country: 'Sweden', city: 'Linkoping' },
  { continent: 'Europe', country: 'Sweden', city: 'Lulea' },
  { continent: 'Europe', country: 'Sweden', city: 'Malmo' },
  { continent: 'Europe', country: 'Sweden', city: 'Norrkoping' },
  { continent: 'Europe', country: 'Sweden', city: 'Orebro' },
  { continent: 'Europe', country: 'Sweden', city: 'Stockholm' },
  { continent: 'Europe', country: 'Sweden', city: 'Umea' },
  { continent: 'Europe', country: 'Sweden', city: 'Uppsala' },
  { continent: 'Europe', country: 'Sweden', city: 'Visby' },
  { continent: 'Europe', country: 'Switzerland', city: 'Basel' },
  { continent: 'Europe', country: 'Switzerland', city: 'Bern' },
  { continent: 'Europe', country: 'Switzerland', city: 'Geneva' },
  { continent: 'Europe', country: 'Switzerland', city: 'Lausanne' },
  { continent: 'Europe', country: 'Switzerland', city: 'Lucerne' },
  { continent: 'Europe', country: 'Switzerland', city: 'Lugano' },
  { continent: 'Europe', country: 'Switzerland', city: 'St Gallen' },
  { continent: 'Europe', country: 'Switzerland', city: 'Zurich' },
  { continent: 'Europe', country: 'UK', city: 'Aberdeen' },
  { continent: 'Europe', country: 'UK', city: 'Bath' },
  { continent: 'Europe', country: 'UK', city: 'Belfast' },
  { continent: 'Europe', country: 'UK', city: 'Birmingham' },
  { continent: 'Europe', country: 'UK', city: 'Brighton' },
  { continent: 'Europe', country: 'UK', city: 'Bristol' },
  { continent: 'Europe', country: 'UK', city: 'Cambridge' },
  { continent: 'Europe', country: 'UK', city: 'Canterbury' },
  { continent: 'Europe', country: 'UK', city: 'Cardiff' },
  { continent: 'Europe', country: 'UK', city: 'Coventry' },
  { continent: 'Europe', country: 'UK', city: 'Dundee' },
  { continent: 'Europe', country: 'UK', city: 'Edinburgh' },
  { continent: 'Europe', country: 'UK', city: 'Exeter' },
  { continent: 'Europe', country: 'UK', city: 'Glasgow' },
  { continent: 'Europe', country: 'UK', city: 'Inverness' },
  { continent: 'Europe', country: 'UK', city: 'Leeds' },
  { continent: 'Europe', country: 'UK', city: 'Leicester' },
  { continent: 'Europe', country: 'UK', city: 'Liverpool' },
  { continent: 'Europe', country: 'UK', city: 'London' },
  { continent: 'Europe', country: 'UK', city: 'Manchester' },
  { continent: 'Europe', country: 'UK', city: 'Newcastle' },
  { continent: 'Europe', country: 'UK', city: 'Norwich' },
  { continent: 'Europe', country: 'UK', city: 'Nottingham' },
  { continent: 'Europe', country: 'UK', city: 'Oxford' },
  { continent: 'Europe', country: 'UK', city: 'Plymouth' },
  { continent: 'Europe', country: 'UK', city: 'Sheffield' },
  { continent: 'Europe', country: 'UK', city: 'Southampton' },
  { continent: 'Europe', country: 'UK', city: 'Swansea' },
  { continent: 'Europe', country: 'UK', city: 'York' },
  { continent: 'Europe', country: 'Ukraine', city: 'Dnipro' },
  { continent: 'Europe', country: 'Ukraine', city: 'Ivano-Frankivsk' },
  { continent: 'Europe', country: 'Ukraine', city: 'Kharkiv' },
  { continent: 'Europe', country: 'Ukraine', city: 'Kyiv' },
  { continent: 'Europe', country: 'Ukraine', city: 'Lviv' },
  { continent: 'Europe', country: 'Ukraine', city: 'Odessa' },
  { continent: 'Europe', country: 'Ukraine', city: 'Vinnytsia' },
  { continent: 'Europe', country: 'Ukraine', city: 'Zaporizhzhia' },

  /* -- N. America -------------------------------------------------- */
  { continent: 'N. America', country: 'Bahamas', city: 'Nassau' },
  { continent: 'N. America', country: 'Barbados', city: 'Bridgetown' },
  { continent: 'N. America', country: 'Belize', city: 'Belize City' },
  { continent: 'N. America', country: 'Bermuda', city: 'Hamilton' },
  { continent: 'N. America', country: 'Canada', city: 'Calgary' },
  { continent: 'N. America', country: 'Canada', city: 'Charlottetown' },
  { continent: 'N. America', country: 'Canada', city: 'Edmonton' },
  { continent: 'N. America', country: 'Canada', city: 'Fredericton' },
  { continent: 'N. America', country: 'Canada', city: 'Halifax' },
  { continent: 'N. America', country: 'Canada', city: 'Hamilton' },
  { continent: 'N. America', country: 'Canada', city: 'Kelowna' },
  { continent: 'N. America', country: 'Canada', city: 'Kitchener' },
  { continent: 'N. America', country: 'Canada', city: 'London' },
  { continent: 'N. America', country: 'Canada', city: 'Moncton' },
  { continent: 'N. America', country: 'Canada', city: 'Montreal' },
  { continent: 'N. America', country: 'Canada', city: 'Ottawa' },
  { continent: 'N. America', country: 'Canada', city: 'Quebec City' },
  { continent: 'N. America', country: 'Canada', city: 'Regina' },
  { continent: 'N. America', country: 'Canada', city: 'Saskatoon' },
  { continent: 'N. America', country: 'Canada', city: 'St Johns' },
  { continent: 'N. America', country: 'Canada', city: 'Thunder Bay' },
  { continent: 'N. America', country: 'Canada', city: 'Toronto' },
  { continent: 'N. America', country: 'Canada', city: 'Vancouver' },
  { continent: 'N. America', country: 'Canada', city: 'Victoria' },
  { continent: 'N. America', country: 'Canada', city: 'Whitehorse' },
  { continent: 'N. America', country: 'Canada', city: 'Windsor' },
  { continent: 'N. America', country: 'Canada', city: 'Winnipeg' },
  { continent: 'N. America', country: 'Canada', city: 'Yellowknife' },
  { continent: 'N. America', country: 'Costa Rica', city: 'San Jose' },
  { continent: 'N. America', country: 'Cuba', city: 'Havana' },
  { continent: 'N. America', country: 'Cuba', city: 'Santiago de Cuba' },
  { continent: 'N. America', country: 'Curacao', city: 'Willemstad' },
  { continent: 'N. America', country: 'Dominican Rep.', city: 'Santiago' },
  { continent: 'N. America', country: 'Dominican Rep.', city: 'Santo Domingo' },
  { continent: 'N. America', country: 'El Salvador', city: 'San Salvador' },
  { continent: 'N. America', country: 'Guatemala', city: 'Guatemala City' },
  { continent: 'N. America', country: 'Haiti', city: 'Port-au-Prince' },
  { continent: 'N. America', country: 'Honduras', city: 'San Pedro Sula' },
  { continent: 'N. America', country: 'Honduras', city: 'Tegucigalpa' },
  { continent: 'N. America', country: 'Jamaica', city: 'Kingston' },
  { continent: 'N. America', country: 'Jamaica', city: 'Montego Bay' },
  { continent: 'N. America', country: 'Mexico', city: 'Aguascalientes' },
  { continent: 'N. America', country: 'Mexico', city: 'Cancun' },
  { continent: 'N. America', country: 'Mexico', city: 'Chihuahua' },
  { continent: 'N. America', country: 'Mexico', city: 'Durango' },
  { continent: 'N. America', country: 'Mexico', city: 'Guadalajara' },
  { continent: 'N. America', country: 'Mexico', city: 'Hermosillo' },
  { continent: 'N. America', country: 'Mexico', city: 'Leon' },
  { continent: 'N. America', country: 'Mexico', city: 'Mazatlan' },
  { continent: 'N. America', country: 'Mexico', city: 'Merida' },
  { continent: 'N. America', country: 'Mexico', city: 'Mexico City' },
  { continent: 'N. America', country: 'Mexico', city: 'Monterrey' },
  { continent: 'N. America', country: 'Mexico', city: 'Morelia' },
  { continent: 'N. America', country: 'Mexico', city: 'Oaxaca' },
  { continent: 'N. America', country: 'Mexico', city: 'Puebla' },
  { continent: 'N. America', country: 'Mexico', city: 'Queretaro' },
  { continent: 'N. America', country: 'Mexico', city: 'Saltillo' },
  { continent: 'N. America', country: 'Mexico', city: 'San Luis Potosi' },
  { continent: 'N. America', country: 'Mexico', city: 'Tijuana' },
  { continent: 'N. America', country: 'Mexico', city: 'Toluca' },
  { continent: 'N. America', country: 'Mexico', city: 'Tuxtla Gutierrez' },
  { continent: 'N. America', country: 'Mexico', city: 'Veracruz' },
  { continent: 'N. America', country: 'Mexico', city: 'Villahermosa' },
  { continent: 'N. America', country: 'Nicaragua', city: 'Managua' },
  { continent: 'N. America', country: 'Panama', city: 'Panama City' },
  { continent: 'N. America', country: 'Puerto Rico', city: 'San Juan' },
  { continent: 'N. America', country: 'Trinidad', city: 'Port of Spain' },
  { continent: 'N. America', country: 'USA', city: 'Albuquerque' },
  { continent: 'N. America', country: 'USA', city: 'Anchorage' },
  { continent: 'N. America', country: 'USA', city: 'Asheville' },
  { continent: 'N. America', country: 'USA', city: 'Atlanta' },
  { continent: 'N. America', country: 'USA', city: 'Austin' },
  { continent: 'N. America', country: 'USA', city: 'Bakersfield' },
  { continent: 'N. America', country: 'USA', city: 'Baltimore' },
  { continent: 'N. America', country: 'USA', city: 'Birmingham' },
  { continent: 'N. America', country: 'USA', city: 'Boise' },
  { continent: 'N. America', country: 'USA', city: 'Boston' },
  { continent: 'N. America', country: 'USA', city: 'Buffalo' },
  { continent: 'N. America', country: 'USA', city: 'Burlington' },
  { continent: 'N. America', country: 'USA', city: 'Charleston' },
  { continent: 'N. America', country: 'USA', city: 'Charlotte' },
  { continent: 'N. America', country: 'USA', city: 'Chattanooga' },
  { continent: 'N. America', country: 'USA', city: 'Chicago' },
  { continent: 'N. America', country: 'USA', city: 'Cincinnati' },
  { continent: 'N. America', country: 'USA', city: 'Cleveland' },
  { continent: 'N. America', country: 'USA', city: 'Colorado Springs' },
  { continent: 'N. America', country: 'USA', city: 'Columbus' },
  { continent: 'N. America', country: 'USA', city: 'Corpus Christi' },
  { continent: 'N. America', country: 'USA', city: 'Dallas' },
  { continent: 'N. America', country: 'USA', city: 'Dayton' },
  { continent: 'N. America', country: 'USA', city: 'Denver' },
  { continent: 'N. America', country: 'USA', city: 'Des Moines' },
  { continent: 'N. America', country: 'USA', city: 'Detroit' },
  { continent: 'N. America', country: 'USA', city: 'Durham' },
  { continent: 'N. America', country: 'USA', city: 'El Paso' },
  { continent: 'N. America', country: 'USA', city: 'Eugene' },
  { continent: 'N. America', country: 'USA', city: 'Fargo' },
  { continent: 'N. America', country: 'USA', city: 'Fort Lauderdale' },
  { continent: 'N. America', country: 'USA', city: 'Fort Worth' },
  { continent: 'N. America', country: 'USA', city: 'Fresno' },
  { continent: 'N. America', country: 'USA', city: 'Grand Rapids' },
  { continent: 'N. America', country: 'USA', city: 'Hartford' },
  { continent: 'N. America', country: 'USA', city: 'Honolulu' },
  { continent: 'N. America', country: 'USA', city: 'Houston' },
  { continent: 'N. America', country: 'USA', city: 'Indianapolis' },
  { continent: 'N. America', country: 'USA', city: 'Jacksonville' },
  { continent: 'N. America', country: 'USA', city: 'Kansas City' },
  { continent: 'N. America', country: 'USA', city: 'Knoxville' },
  { continent: 'N. America', country: 'USA', city: 'Las Vegas' },
  { continent: 'N. America', country: 'USA', city: 'Lexington' },
  { continent: 'N. America', country: 'USA', city: 'Little Rock' },
  { continent: 'N. America', country: 'USA', city: 'Los Angeles' },
  { continent: 'N. America', country: 'USA', city: 'Louisville' },
  { continent: 'N. America', country: 'USA', city: 'Madison' },
  { continent: 'N. America', country: 'USA', city: 'Memphis' },
  { continent: 'N. America', country: 'USA', city: 'Miami' },
  { continent: 'N. America', country: 'USA', city: 'Milwaukee' },
  { continent: 'N. America', country: 'USA', city: 'Minneapolis' },
  { continent: 'N. America', country: 'USA', city: 'Missoula' },
  { continent: 'N. America', country: 'USA', city: 'Mobile' },
  { continent: 'N. America', country: 'USA', city: 'Nashville' },
  { continent: 'N. America', country: 'USA', city: 'New Orleans' },
  { continent: 'N. America', country: 'USA', city: 'New York' },
  { continent: 'N. America', country: 'USA', city: 'Norfolk' },
  { continent: 'N. America', country: 'USA', city: 'Oklahoma City' },
  { continent: 'N. America', country: 'USA', city: 'Omaha' },
  { continent: 'N. America', country: 'USA', city: 'Orlando' },
  { continent: 'N. America', country: 'USA', city: 'Philadelphia' },
  { continent: 'N. America', country: 'USA', city: 'Phoenix' },
  { continent: 'N. America', country: 'USA', city: 'Pittsburgh' },
  { continent: 'N. America', country: 'USA', city: 'Portland' },
  { continent: 'N. America', country: 'USA', city: 'Providence' },
  { continent: 'N. America', country: 'USA', city: 'Raleigh' },
  { continent: 'N. America', country: 'USA', city: 'Reno' },
  { continent: 'N. America', country: 'USA', city: 'Richmond' },
  { continent: 'N. America', country: 'USA', city: 'Sacramento' },
  { continent: 'N. America', country: 'USA', city: 'Salt Lake City' },
  { continent: 'N. America', country: 'USA', city: 'San Antonio' },
  { continent: 'N. America', country: 'USA', city: 'San Diego' },
  { continent: 'N. America', country: 'USA', city: 'San Francisco' },
  { continent: 'N. America', country: 'USA', city: 'Santa Fe' },
  { continent: 'N. America', country: 'USA', city: 'Savannah' },
  { continent: 'N. America', country: 'USA', city: 'Seattle' },
  { continent: 'N. America', country: 'USA', city: 'Sioux Falls' },
  { continent: 'N. America', country: 'USA', city: 'Spokane' },
  { continent: 'N. America', country: 'USA', city: 'St Louis' },
  { continent: 'N. America', country: 'USA', city: 'Tacoma' },
  { continent: 'N. America', country: 'USA', city: 'Tallahassee' },
  { continent: 'N. America', country: 'USA', city: 'Tampa' },
  { continent: 'N. America', country: 'USA', city: 'Tucson' },
  { continent: 'N. America', country: 'USA', city: 'Tulsa' },
  { continent: 'N. America', country: 'USA', city: 'Washington DC' },
  { continent: 'N. America', country: 'USA', city: 'Wichita' },

  /* -- S. America -------------------------------------------------- */
  { continent: 'S. America', country: 'Argentina', city: 'Bariloche' },
  { continent: 'S. America', country: 'Argentina', city: 'Buenos Aires' },
  { continent: 'S. America', country: 'Argentina', city: 'Cordoba' },
  { continent: 'S. America', country: 'Argentina', city: 'La Plata' },
  { continent: 'S. America', country: 'Argentina', city: 'Mar del Plata' },
  { continent: 'S. America', country: 'Argentina', city: 'Mendoza' },
  { continent: 'S. America', country: 'Argentina', city: 'Neuquen' },
  { continent: 'S. America', country: 'Argentina', city: 'Posadas' },
  { continent: 'S. America', country: 'Argentina', city: 'Resistencia' },
  { continent: 'S. America', country: 'Argentina', city: 'Rosario' },
  { continent: 'S. America', country: 'Argentina', city: 'Salta' },
  { continent: 'S. America', country: 'Argentina', city: 'San Juan' },
  { continent: 'S. America', country: 'Argentina', city: 'Santa Fe' },
  { continent: 'S. America', country: 'Argentina', city: 'Tucuman' },
  { continent: 'S. America', country: 'Argentina', city: 'Ushuaia' },
  { continent: 'S. America', country: 'Bolivia', city: 'Cochabamba' },
  { continent: 'S. America', country: 'Bolivia', city: 'La Paz' },
  { continent: 'S. America', country: 'Bolivia', city: 'Santa Cruz' },
  { continent: 'S. America', country: 'Bolivia', city: 'Sucre' },
  { continent: 'S. America', country: 'Brazil', city: 'Aracaju' },
  { continent: 'S. America', country: 'Brazil', city: 'Belem' },
  { continent: 'S. America', country: 'Brazil', city: 'Belo Horizonte' },
  { continent: 'S. America', country: 'Brazil', city: 'Brasilia' },
  { continent: 'S. America', country: 'Brazil', city: 'Campinas' },
  { continent: 'S. America', country: 'Brazil', city: 'Campo Grande' },
  { continent: 'S. America', country: 'Brazil', city: 'Cuiaba' },
  { continent: 'S. America', country: 'Brazil', city: 'Curitiba' },
  { continent: 'S. America', country: 'Brazil', city: 'Florianopolis' },
  { continent: 'S. America', country: 'Brazil', city: 'Fortaleza' },
  { continent: 'S. America', country: 'Brazil', city: 'Goiania' },
  { continent: 'S. America', country: 'Brazil', city: 'Joao Pessoa' },
  { continent: 'S. America', country: 'Brazil', city: 'Joinville' },
  { continent: 'S. America', country: 'Brazil', city: 'Londrina' },
  { continent: 'S. America', country: 'Brazil', city: 'Maceio' },
  { continent: 'S. America', country: 'Brazil', city: 'Manaus' },
  { continent: 'S. America', country: 'Brazil', city: 'Natal' },
  { continent: 'S. America', country: 'Brazil', city: 'Porto Alegre' },
  { continent: 'S. America', country: 'Brazil', city: 'Recife' },
  { continent: 'S. America', country: 'Brazil', city: 'Ribeirao Preto' },
  { continent: 'S. America', country: 'Brazil', city: 'Rio de Janeiro' },
  { continent: 'S. America', country: 'Brazil', city: 'Salvador' },
  { continent: 'S. America', country: 'Brazil', city: 'Santos' },
  { continent: 'S. America', country: 'Brazil', city: 'Sao Luis' },
  { continent: 'S. America', country: 'Brazil', city: 'Sao Paulo' },
  { continent: 'S. America', country: 'Brazil', city: 'Teresina' },
  { continent: 'S. America', country: 'Brazil', city: 'Uberlandia' },
  { continent: 'S. America', country: 'Brazil', city: 'Vitoria' },
  { continent: 'S. America', country: 'Chile', city: 'Antofagasta' },
  { continent: 'S. America', country: 'Chile', city: 'Concepcion' },
  { continent: 'S. America', country: 'Chile', city: 'Iquique' },
  { continent: 'S. America', country: 'Chile', city: 'La Serena' },
  { continent: 'S. America', country: 'Chile', city: 'Puerto Montt' },
  { continent: 'S. America', country: 'Chile', city: 'Punta Arenas' },
  { continent: 'S. America', country: 'Chile', city: 'Santiago' },
  { continent: 'S. America', country: 'Chile', city: 'Talca' },
  { continent: 'S. America', country: 'Chile', city: 'Temuco' },
  { continent: 'S. America', country: 'Chile', city: 'Valparaiso' },
  { continent: 'S. America', country: 'Colombia', city: 'Barranquilla' },
  { continent: 'S. America', country: 'Colombia', city: 'Bogota' },
  { continent: 'S. America', country: 'Colombia', city: 'Bucaramanga' },
  { continent: 'S. America', country: 'Colombia', city: 'Cali' },
  { continent: 'S. America', country: 'Colombia', city: 'Cartagena' },
  { continent: 'S. America', country: 'Colombia', city: 'Cucuta' },
  { continent: 'S. America', country: 'Colombia', city: 'Ibague' },
  { continent: 'S. America', country: 'Colombia', city: 'Manizales' },
  { continent: 'S. America', country: 'Colombia', city: 'Medellin' },
  { continent: 'S. America', country: 'Colombia', city: 'Pereira' },
  { continent: 'S. America', country: 'Colombia', city: 'Santa Marta' },
  { continent: 'S. America', country: 'Colombia', city: 'Villavicencio' },
  { continent: 'S. America', country: 'Ecuador', city: 'Ambato' },
  { continent: 'S. America', country: 'Ecuador', city: 'Cuenca' },
  { continent: 'S. America', country: 'Ecuador', city: 'Guayaquil' },
  { continent: 'S. America', country: 'Ecuador', city: 'Loja' },
  { continent: 'S. America', country: 'Ecuador', city: 'Quito' },
  { continent: 'S. America', country: 'French Guiana', city: 'Cayenne' },
  { continent: 'S. America', country: 'Guyana', city: 'Georgetown' },
  { continent: 'S. America', country: 'Paraguay', city: 'Asuncion' },
  { continent: 'S. America', country: 'Paraguay', city: 'Ciudad del Este' },
  { continent: 'S. America', country: 'Paraguay', city: 'Encarnacion' },
  { continent: 'S. America', country: 'Peru', city: 'Arequipa' },
  { continent: 'S. America', country: 'Peru', city: 'Chiclayo' },
  { continent: 'S. America', country: 'Peru', city: 'Cusco' },
  { continent: 'S. America', country: 'Peru', city: 'Huancayo' },
  { continent: 'S. America', country: 'Peru', city: 'Iquitos' },
  { continent: 'S. America', country: 'Peru', city: 'Lima' },
  { continent: 'S. America', country: 'Peru', city: 'Piura' },
  { continent: 'S. America', country: 'Peru', city: 'Tacna' },
  { continent: 'S. America', country: 'Peru', city: 'Trujillo' },
  { continent: 'S. America', country: 'Suriname', city: 'Paramaribo' },
  { continent: 'S. America', country: 'Uruguay', city: 'Montevideo' },
  { continent: 'S. America', country: 'Uruguay', city: 'Punta del Este' },
  { continent: 'S. America', country: 'Uruguay', city: 'Salto' },
  { continent: 'S. America', country: 'Venezuela', city: 'Barquisimeto' },
  { continent: 'S. America', country: 'Venezuela', city: 'Caracas' },
  { continent: 'S. America', country: 'Venezuela', city: 'Ciudad Guayana' },
  { continent: 'S. America', country: 'Venezuela', city: 'Maracaibo' },
  { continent: 'S. America', country: 'Venezuela', city: 'Merida' },
  { continent: 'S. America', country: 'Venezuela', city: 'Puerto La Cruz' },
  { continent: 'S. America', country: 'Venezuela', city: 'San Cristobal' },
  { continent: 'S. America', country: 'Venezuela', city: 'Valencia' },

  /* -- Oceania ----------------------------------------------------- */
  { continent: 'Oceania', country: 'Australia', city: 'Adelaide' },
  { continent: 'Oceania', country: 'Australia', city: 'Alice Springs' },
  { continent: 'Oceania', country: 'Australia', city: 'Ballarat' },
  { continent: 'Oceania', country: 'Australia', city: 'Bendigo' },
  { continent: 'Oceania', country: 'Australia', city: 'Brisbane' },
  { continent: 'Oceania', country: 'Australia', city: 'Broome' },
  { continent: 'Oceania', country: 'Australia', city: 'Bundaberg' },
  { continent: 'Oceania', country: 'Australia', city: 'Cairns' },
  { continent: 'Oceania', country: 'Australia', city: 'Canberra' },
  { continent: 'Oceania', country: 'Australia', city: 'Darwin' },
  { continent: 'Oceania', country: 'Australia', city: 'Geelong' },
  { continent: 'Oceania', country: 'Australia', city: 'Gold Coast' },
  { continent: 'Oceania', country: 'Australia', city: 'Hobart' },
  { continent: 'Oceania', country: 'Australia', city: 'Launceston' },
  { continent: 'Oceania', country: 'Australia', city: 'Lismore' },
  { continent: 'Oceania', country: 'Australia', city: 'Mackay' },
  { continent: 'Oceania', country: 'Australia', city: 'Melbourne' },
  { continent: 'Oceania', country: 'Australia', city: 'Newcastle' },
  { continent: 'Oceania', country: 'Australia', city: 'Perth' },
  { continent: 'Oceania', country: 'Australia', city: 'Rockhampton' },
  { continent: 'Oceania', country: 'Australia', city: 'Shepparton' },
  { continent: 'Oceania', country: 'Australia', city: 'Sunshine Coast' },
  { continent: 'Oceania', country: 'Australia', city: 'Sydney' },
  { continent: 'Oceania', country: 'Australia', city: 'Tamworth' },
  { continent: 'Oceania', country: 'Australia', city: 'Toowoomba' },
  { continent: 'Oceania', country: 'Australia', city: 'Townsville' },
  { continent: 'Oceania', country: 'Australia', city: 'Wagga Wagga' },
  { continent: 'Oceania', country: 'Australia', city: 'Wollongong' },
  { continent: 'Oceania', country: 'Fiji', city: 'Nadi' },
  { continent: 'Oceania', country: 'Fiji', city: 'Suva' },
  { continent: 'Oceania', country: 'French Polynesia', city: 'Papeete' },
  { continent: 'Oceania', country: 'Guam', city: 'Hagatna' },
  { continent: 'Oceania', country: 'New Caledonia', city: 'Noumea' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Auckland' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Christchurch' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Dunedin' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Hamilton' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Invercargill' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Napier' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Nelson' },
  { continent: 'Oceania', country: 'New Zealand', city: 'New Plymouth' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Palmerston North' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Queenstown' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Rotorua' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Tauranga' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Wellington' },
  { continent: 'Oceania', country: 'New Zealand', city: 'Whangarei' },
  { continent: 'Oceania', country: 'Papua New Guinea', city: 'Port Moresby' },
  { continent: 'Oceania', country: 'Samoa', city: 'Apia' },
  { continent: 'Oceania', country: 'Tonga', city: 'Nukualofa' },
  { continent: 'Oceania', country: 'Vanuatu', city: 'Port Vila' },
];

/* ── constants ────────────────────────────────────────────────────── */

const CC_JOG = 14;
const CC_CLICK = 3;

const RG_API = 'https://radio.garden/api';
const UA = 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36';
const SPINNER = ['-', '/', '|', '\\'];

/* Never /tmp on the device: the root filesystem is usually full. */
const CACHE_DIR = '/data/UserData/schwung/cache/radiogarden';
const NAV_PATH = CACHE_DIR + '/nav.json';
const FETCH_TIMEOUT_MS = 20000;

/* A page that has not been drawn for this long was not on screen. */
const AWAY_MS = 250;

/*
 * THE HOST'S LIST, exactly (list_geometry.mjs / menu_layout drawMenuList /
 * drawScrollbar), shifted into this page's band, which starts at screen row 9:
 * rows every 9px from screen y 10 (band y 1), labels at x 9 and 111px wide,
 * the highlight full width from 1px above the text, 9 tall, and the dotted
 * scrollbar track at x 126. Anything else reads as a different widget.
 */
const ROW_H = 9, LIST_X = 9, LIST_W = 111, LIST_Y = 1, HI_OFF = 1, VISIBLE_ROWS = 5;
const ROW_INK = 7, TRACK_X = 126;

const FRAME_X = 4, FRAME_Y = 0, FRAME_W = 120, FRAME_H = 45, ARM = 4;

/* The host face's glyph widths, space to '~' (see dr32 resample.js). */
const GLYPH_W = '51355552335525255355555555224545555555555355555555555555555353553554555553443555555555555553135';
function textW(t) {
  const s = String(t);
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += (c >= 32 && c <= 126 ? Number(GLYPH_W[c - 32]) : 5) + 1;
  }
  return w > 0 ? w - 1 : 0;
}

/* ASCII only (the face has nothing else), squeezed to fit `maxW` pixels. */
function fit(text, maxW) {
  let s = String(text || '').replace(/[^\x20-\x7E]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) s = '(untitled)';
  if (textW(s) <= maxW) return s;
  while (s.length > 1 && textW(s + '..') > maxW) s = s.slice(0, -1);
  return s + '..';
}

function unique(arr) {
  const out = [];
  for (const x of arr) if (out.indexOf(x) < 0) out.push(x);
  return out;
}

/* ── files and the network ────────────────────────────────────────── */

function ensureCacheDir() {
  try { os.mkdir('/data/UserData/schwung/cache'); } catch (e) {}
  try { os.mkdir(CACHE_DIR); } catch (e) {}
}

function readText(path) {
  try {
    const f = std.open(path, 'r');
    if (!f) return null;
    const s = f.readAsString();
    f.close();
    return s;
  } catch (e) { return null; }
}

function writeText(path, text) {
  try {
    const f = std.open(path, 'w');
    if (!f) return;
    f.puts(text);
    f.close();
  } catch (e) {}
}

function exists(path) {
  try { const r = os.stat(path); return Array.isArray(r) && r[1] === 0; }
  catch (e) { return false; }
}

function urlEncode(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) ||
        (c >= 0x30 && c <= 0x39) || c === 0x2D || c === 0x5F ||
        c === 0x2E || c === 0x7E) {
      out += str[i];
    } else if (c === 0x20) {
      out += '+';
    } else {
      const hex = c.toString(16).toUpperCase();
      out += '%' + (hex.length < 2 ? '0' : '') + hex;
    }
  }
  return out;
}

function searchUrl(city, country) {
  return RG_API + '/search?q=' + urlEncode(city + ' ' + country);
}
function channelsUrl(placeId) {
  return RG_API + '/ara/content/page/' + placeId + '/channels';
}

/* Blocking GET (wget with a browser UA, which Cloudflare lets through). */
function httpGetJson(url) {
  let f;
  try {
    f = std.popen('wget -U "' + UA + '" -q -T 10 -O - "' + url + '"', 'r');
    if (!f) return null;
    const raw = f.readAsString();
    f.close();
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    if (f) try { f.close(); } catch (_) {}
    return null;
  }
}

/* Background GET into `path`. Done when `path` exists; failed when
 * `path + '.err'` does. Returns the child's pid (reaped by pollFetch). */
function httpGetToFile(url, path) {
  try { os.remove(path); } catch (e) {}
  try { os.remove(path + '.err'); } catch (e) {}
  try { os.remove(path + '.part'); } catch (e) {}
  const cmd = 'wget -U "' + UA + '" -q -T 10 -O "' + path + '.part" "' + url + '"' +
              ' && mv "' + path + '.part" "' + path + '"' +
              ' || echo fail > "' + path + '.err"';
  try { return os.exec(['/bin/sh', '-c', cmd], { block: false }); }
  catch (e) { writeText(path + '.err', 'fail'); return -1; }
}

/* Radio Garden's search answer -> a place id (see the API notes in git
 * history: page.url "/visit/<slug>/<id>", or a channel hit's page.place.id). */
function placeIdFrom(data) {
  const hits = data && data.hits && data.hits.hits;
  if (!Array.isArray(hits)) return null;
  for (const hit of hits) {
    const src = hit._source || hit;
    if (src.type === 'place') {
      const parts = ((src.page && src.page.url) || '').split('/');
      const id = parts[parts.length - 1];
      if (id && id.length > 2) return id;
    }
  }
  for (const hit of hits) {
    const src = hit._source || hit;
    if (src.type === 'channel' && src.page && src.page.place && src.page.place.id)
      return src.page.place.id;
  }
  return null;
}

/* A place's channels answer -> [{ title, streamUrl }]. */
function stationsFrom(data) {
  const out = [];
  const content = (data && data.data && data.data.content) || [];
  for (const section of content) {
    for (const item of (section.items || [])) {
      const page = item.page || {};
      const parts = (page.url || '').split('/');
      const id = parts.length >= 3 ? parts[parts.length - 1] : null;
      if (!id) continue;
      out.push({
        title: page.title || '(Unknown Station)',
        streamUrl: RG_API + '/ara/content/listen/' + id + '/channel.mp3',
      });
    }
  }
  return out;
}

/* ── the browse tree ──────────────────────────────────────────────── */

/* A level is { title, rows: [{ label, act }], cursor, top }. `act` names what
 * a click does, as data, so the stack can be saved and rebuilt. */
function rootLevel() {
  const rows = [{ label: '[Random]', act: { kind: 'random' } }];
  for (const c of unique(CITIES.map((e) => e.continent)))
    rows.push({ label: c, act: { kind: 'continent', continent: c } });
  return { title: 'Radio Garden', rows, cursor: 0, top: 0 };
}

function continentLevel(continent) {
  const rows = unique(CITIES.filter((e) => e.continent === continent).map((e) => e.country))
    .map((country) => ({ label: country, act: { kind: 'country', continent, country } }));
  return { title: continent, rows, cursor: 0, top: 0 };
}

function countryLevel(continent, country) {
  const rows = CITIES.filter((e) => e.continent === continent && e.country === country)
    .map((e) => ({ label: e.city, act: { kind: 'city', city: e.city, country } }));
  return { title: country, rows, cursor: 0, top: 0 };
}

function stationsLevel(city, stations) {
  const rows = stations.map((st) => ({ label: st.title, act: { kind: 'station', station: st } }));
  return { title: city, rows, cursor: 0, top: 0, city };
}

/* ── state (per slot: the host hands the same object to hooks and draw) ── */

function stateOf(state) {
  if (!state.ready) {
    state.ready = true;
    state.entered = false;
    state.lastDraw = -1;
    state.stack = [rootLevel()];
    state.fetch = null;          /* { phase, city, country, path, pid, startedMs } */
    state.note = null;           /* { level, row, text }: a failed fetch, on its row */
    state.stationName = '';      /* what this page last tuned, for an old host */
    state.city = '';
    restoreNav(state);
  }
  return state;
}

function cur(state) { return state.stack[state.stack.length - 1]; }

/* Where you were, so the browser reopens there. Station lists are cached with
 * it so coming back does not refetch. */
function saveNav(state) {
  ensureCacheDir();
  const path = [];
  for (const lvl of state.stack.slice(1)) {
    if (lvl.city) path.push({ city: lvl.city, stations: lvl.rows.map((r) => r.act.station) });
    else path.push({ title: lvl.title });
  }
  writeText(NAV_PATH, JSON.stringify({ path, stationName: state.stationName, city: state.city }));
}

function restoreNav(state) {
  const raw = readText(NAV_PATH);
  if (!raw) return;
  let nav;
  try { nav = JSON.parse(raw); } catch (e) { return; }
  if (!nav || !Array.isArray(nav.path)) return;
  state.stationName = nav.stationName || '';
  state.city = nav.city || '';
  const p = nav.path;
  if (p[0] && p[0].title && CITIES.some((e) => e.continent === p[0].title)) {
    state.stack.push(continentLevel(p[0].title));
    if (p[1] && p[1].title && CITIES.some((e) => e.continent === p[0].title && e.country === p[1].title)) {
      state.stack.push(countryLevel(p[0].title, p[1].title));
      if (p[2] && p[2].city && Array.isArray(p[2].stations) && p[2].stations.length)
        state.stack.push(stationsLevel(p[2].city, p[2].stations.filter(Boolean)));
    }
  }
}

function move(lvl, delta) {
  const n = lvl.rows.length;
  if (!n) return;
  lvl.cursor = Math.max(0, Math.min(n - 1, lvl.cursor + (delta > 0 ? 1 : -1)));
  if (lvl.cursor < lvl.top) lvl.top = lvl.cursor;
  if (lvl.cursor >= lvl.top + VISIBLE_ROWS) lvl.top = lvl.cursor - VISIBLE_ROWS + 1;
}

/* ── actions (hooks only: they may set params) ────────────────────── */

function play(ctx, state, station, city) {
  ctx.setParam('station_name', station.title);
  ctx.setParam('stream_url', station.streamUrl);
  state.stationName = station.title;
  state.city = city || state.city;
  state.note = null;
  saveNav(state);
}

function startCityFetch(state, city, country) {
  ensureCacheDir();
  const path = CACHE_DIR + '/search.json';
  const lvl = cur(state);
  state.fetch = { phase: 'search', city, country, path, level: lvl, row: lvl.cursor,
                  pid: httpGetToFile(searchUrl(city, country), path), startedMs: Date.now() };
  state.note = null;
}

/* Synchronous, because it ends by setting the stream (see the header). */
function playRandom(ctx, state) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const e = CITIES[Math.floor(Math.random() * CITIES.length)];
    const placeId = placeIdFrom(httpGetJson(searchUrl(e.city, e.country)));
    if (!placeId) continue;
    const stations = stationsFrom(httpGetJson(channelsUrl(placeId)));
    if (!stations.length) continue;
    play(ctx, state, stations[Math.floor(Math.random() * stations.length)], e.city);
    return;
  }
  const lvl = cur(state);
  state.note = { level: lvl, row: lvl.cursor, text: 'no luck' };
}

function activate(ctx, state) {
  const lvl = cur(state);
  const row = lvl.rows[lvl.cursor];
  if (!row || state.fetch) return;
  const a = row.act;
  if (a.kind === 'random') playRandom(ctx, state);
  else if (a.kind === 'continent') { state.stack.push(continentLevel(a.continent)); saveNav(state); }
  else if (a.kind === 'country') { state.stack.push(countryLevel(a.continent, a.country)); saveNav(state); }
  else if (a.kind === 'city') startCityFetch(state, a.city, a.country);
  else if (a.kind === 'station') play(ctx, state, a.station, lvl.city);
}

/* ── the background fetch, advanced from the draw ─────────────────── */

function reap(pid) {
  if (pid > 0) { try { os.waitpid(pid, os.WNOHANG); } catch (e) {} }
}

function pollFetch(state, nowMs) {
  const f = state.fetch;
  if (!f) return;
  const fail = (msg) => { reap(f.pid); state.fetch = null; state.note = { level: f.level, row: f.row, text: msg }; };
  if (exists(f.path)) {
    reap(f.pid);
    let data = null;
    try { data = JSON.parse(readText(f.path) || ''); } catch (e) { data = null; }
    if (f.phase === 'search') {
      const placeId = placeIdFrom(data);
      if (!placeId) { fail('not found'); return; }
      f.phase = 'channels';
      f.path = CACHE_DIR + '/channels.json';
      f.pid = httpGetToFile(channelsUrl(placeId), f.path);
      f.startedMs = nowMs;
      return;
    }
    const stations = stationsFrom(data);
    if (!stations.length) { fail('no stations'); return; }
    state.fetch = null;
    state.stack.push(stationsLevel(f.city, stations));
    saveNav(state);
    return;
  }
  if (exists(f.path + '.err')) { fail('offline'); return; }
  if (nowMs - f.startedMs > FETCH_TIMEOUT_MS) fail('timed out');
}

/* ── drawing ──────────────────────────────────────────────────────── */

function drawBrackets(ctx) {
  const x = FRAME_X, y = FRAME_Y, w = FRAME_W, h = FRAME_H;
  for (let i = 0; i < ARM; i++) {
    ctx.fillRect(x + i, y, 1, 1, 1);
    ctx.fillRect(x + w - 1 - i, y, 1, 1, 1);
    ctx.fillRect(x + i, y + h - 1, 1, 1, 1);
    ctx.fillRect(x + w - 1 - i, y + h - 1, 1, 1, 1);
  }
  for (let i = 0; i < ARM - 1; i++) {
    ctx.fillRect(x, y + i, 1, 1, 1);
    ctx.fillRect(x + w - 1, y + i, 1, 1, 1);
    ctx.fillRect(x, y + h - 1 - i, 1, 1, 1);
    ctx.fillRect(x + w - 1, y + h - 1 - i, 1, 1, 1);
  }
}

/* What the row under a fetch says while it loads, or after it failed. */
function rowSuffix(state, lvl, r, nowMs) {
  const f = state.fetch;
  if (f && f.level === lvl && f.row === r)
    return SPINNER[Math.floor(nowMs / 150) % SPINNER.length];
  if (state.note && state.note.level === lvl && state.note.row === r) return state.note.text;
  return '';
}

/*
 * ONE picture for both states, so entering is visible.
 *
 * The click that enters this door is the host's and nothing reports it, so
 * "entered" is only known at the NEXT gesture. So un-entered and entered are
 * the same list and differ the way the host's own list doors do: brackets
 * un-entered, the row highlight entered.
 */
function drawPageBody(ctx, state, nowMs) {
  const lvl = cur(state);
  const n = lvl.rows.length;
  for (let i = 0; i < VISIBLE_ROWS; i++) {
    const r = lvl.top + i;
    if (r >= n) break;
    const y = LIST_Y + i * ROW_H;
    const on = state.entered && r === lvl.cursor;
    if (on) ctx.fillRect(0, y - HI_OFF, 128, ROW_H, 1);
    const suffix = rowSuffix(state, lvl, r, nowMs);
    const label = suffix ? fit(lvl.rows[r].label, LIST_W - textW(' ' + suffix)) + ' ' + suffix
                         : fit(lvl.rows[r].label, LIST_W);
    ctx.print(LIST_X, y, label, on ? 0 : 1);
  }
  if (lvl.top > 0 || lvl.top + VISIBLE_ROWS < n) {
    const trackBottom = LIST_Y + (VISIBLE_ROWS - 1) * ROW_H + ROW_INK;
    const trackH = trackBottom - LIST_Y;
    for (let y = LIST_Y; y < trackBottom; y += 2) ctx.fillRect(TRACK_X, y, 1, 1, 1);
    const thumbH = Math.max(2, Math.round((VISIBLE_ROWS / n) * trackH));
    const maxStart = n - VISIBLE_ROWS;
    const ty = LIST_Y + (maxStart > 0 ? Math.round((lvl.top / maxStart) * (trackH - thumbH)) : 0);
    ctx.fillRect(TRACK_X, ty, 1, thumbH, 1);
  }
  if (!state.entered) drawBrackets(ctx);
}

/* ── the overlay ──────────────────────────────────────────────────── */

globalThis.canvas_overlay = {
  onMidi(ctx, msg) {
    const d = msg && msg.data;
    if (!d || d.length < 3 || (d[0] & 0xF0) !== 0xB0) return;
    const state = stateOf(ctx.state);
    /* Only an ENTERED door is handed gestures: this one proves it. */
    const wasEntered = state.entered;
    state.entered = true;
    state.note = null;
    if (d[1] === CC_JOG) {
      const v = d[2];
      const delta = v === 0 ? 0 : (v <= 63 ? v : -(128 - v));
      if (delta && wasEntered) move(cur(state), delta);
      return;
    }
    if (d[1] === CC_CLICK && d[2] > 0 && wasEntered) activate(ctx, state);
    /* A hook call proves the page is on screen. [Random] blocks for a second
     * or more, and without this the next draw reads the gap as "you left" and
     * draws the page un-entered while the host still has it entered. */
    state.lastDraw = Date.now();
  },

  /* true = "I went up a level, keep me here"; anything else = leave the door. */
  handleBack(ctx) {
    const state = stateOf(ctx.state);
    if (state.fetch) { reap(state.fetch.pid); state.fetch = null; return true; }
    if (state.stack.length > 1) {
      state.stack.pop();
      state.note = null;
      saveNav(state);
      return true;
    }
    state.entered = false;
    return false;
  },

  drawPage(ctx, info) {
    const state = stateOf(info.state || {});
    const nowMs = typeof info.nowMs === 'number' ? info.nowMs : Date.now();
    if (state.lastDraw < 0 || nowMs - state.lastDraw > AWAY_MS) state.entered = false;
    state.lastDraw = nowMs;
    pollFetch(state, nowMs);
    drawPageBody(ctx, state, nowMs);
  },
};
