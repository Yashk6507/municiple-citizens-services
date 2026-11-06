/**
 * Municipal service taxonomy and routing configuration (starter data).
 *
 * This file is the single source of truth for:
 *  - Service categories / subcategories (Phase 2)
 *  - Departments used for automatic routing (Phase 6)
 *  - Ward list used for location routing (Phase 6)
 *  - Default SLA targets per priority (Phase 7)
 *
 * Seeding is idempotent: rows are matched on their `code`, so re-running the
 * server never creates duplicate categories. Administrators can override all
 * of this data through the protected administrative interface.
 */

const DEPARTMENTS = [
  { code: "roads", name: "Roads and Transport Department", description: "Roads, footpaths, signage, road markings and public parking." },
  { code: "water", name: "Water Supply Department", description: "Drinking water supply, pipelines, public taps and water quality." },
  { code: "drainage", name: "Drainage and Sewerage Department", description: "Stormwater drains, sewers, manholes and drainage flooding." },
  { code: "sanitation", name: "Sanitation and Solid Waste Department", description: "Garbage collection, street sweeping, dustbins and waste disposal." },
  { code: "electrical", name: "Electrical and Public Lighting Department", description: "Streetlights, poles, public lighting and electrical hazards." },
  { code: "health", name: "Public Health and Pest Control Department", description: "Vector control, fogging, public toilets and health hazards." },
  { code: "parks", name: "Parks and Gardens Department", description: "Gardens, playgrounds, walking tracks, benches and trees." },
  { code: "revenue", name: "Revenue and Property Tax Department", description: "Property tax, assessments, dues and revenue certificates." },
  { code: "townplanning", name: "Town Planning and Building Permissions Department", description: "Building permissions, occupancy certificates, zoning and land use." },
  { code: "fire", name: "Fire and Emergency Safety Department", description: "Fire safety, NOC, emergency access and unsafe structures." },
  { code: "animal", name: "Animal Welfare and Control Department", description: "Stray animals, vaccination, sterilisation and carcass removal." },
  { code: "education", name: "Education and Community Welfare Department", description: "Municipal schools, libraries, community halls and welfare schemes." },
  { code: "markets", name: "Markets and Public Facilities Department", description: "Municipal markets, public toilets, bus shelters and hoardings." },
  { code: "environment", name: "Environment Department", description: "Pollution, waste burning and environmental nuisance." },
  { code: "general", name: "General Administration (Review Queue)", description: "Complaints that could not be routed automatically. Requires manual review." }
];

/**
 * Wards are administrative configuration, NOT inferred from an address.
 * A complaint is only linked to a ward when the citizen explicitly selects one,
 * or when an authorised administrator assigns it.
 */
const WARDS = [
  { code: "W01", name: "Ward 1 - Civil Lines", zone: "Zone A" },
  { code: "W02", name: "Ward 2 - Gandhinagar", zone: "Zone A" },
  { code: "W03", name: "Ward 3 - Station Road", zone: "Zone A" },
  { code: "W04", name: "Ward 4 - Shivaji Nagar", zone: "Zone B" },
  { code: "W05", name: "Ward 5 - Sambhaji Nagar", zone: "Zone B" },
  { code: "W06", name: "Ward 6 - Kranti Chowk", zone: "Zone B" },
  { code: "W07", name: "Ward 7 - Market Yard", zone: "Zone C" },
  { code: "W08", name: "Ward 8 - Industrial Area", zone: "Zone C" },
  { code: "W09", name: "Ward 9 - Old Town", zone: "Zone C" },
  { code: "W10", name: "Ward 10 - Outer Ring", zone: "Zone D" }
];

/**
 * Default internal resolution targets. These are INTERNAL municipal targets
 * configured by the administrator. They are NOT legally mandated or officially
 * published government service-level agreements.
 */
const SLA_DEFAULTS = [
  { priority: "critical", target_hours: 24 },
  { priority: "high", target_hours: 48 },
  { priority: "medium", target_hours: 96 },
  { priority: "low", target_hours: 168 }
];

// Item types used across the services portal (Phase 9).
// complaint   -> a routable civic complaint
// application -> a documented submission / referral workflow handled by staff
// information -> a service-information page only (no record is issued here)
// payment     -> payment information (no card details are collected here)
// external    -> an authorised official external service link
const CATEGORIES = [
  {
    code: "roads",
    name: "Roads and Transport",
    kind: "complaint",
    description: "Road surface, footpaths, signs, markings and road-related assets.",
    subcategories: [
      { code: "potholes", name: "Potholes and damaged roads", department: "roads", priority: "high" },
      { code: "broken_footpaths", name: "Broken footpaths", department: "roads" },
      { code: "obstructed_footpaths", name: "Obstructed footpaths", department: "roads" },
      { code: "damaged_speed_breakers", name: "Damaged speed breakers", department: "roads", priority: "high" },
      { code: "missing_road_signs", name: "Missing road signs", department: "roads" },
      { code: "missing_road_markings", name: "Missing road markings", department: "roads" },
      { code: "damaged_road_dividers", name: "Damaged road dividers", department: "roads" },
      { code: "road_waterlogging", name: "Road waterlogging", department: "drainage", priority: "high" },
      { code: "damaged_public_parking", name: "Damaged public parking facilities", department: "roads" },
      { code: "other_road_problems", name: "Other road-related problems", department: "roads", priority: "low" }
    ]
  },
  {
    code: "water_drainage",
    name: "Water Supply and Drainage",
    kind: "complaint",
    description: "Drinking water supply, water quality, drains, sewers and manholes.",
    subcategories: [
      { code: "no_water_supply", name: "No water supply", department: "water", priority: "high" },
      { code: "low_water_pressure", name: "Low water pressure", department: "water" },
      { code: "contaminated_water", name: "Contaminated water", department: "water", priority: "critical" },
      { code: "foul_smelling_water", name: "Foul-smelling water", department: "water", priority: "high" },
      { code: "leaking_water_pipelines", name: "Leaking water pipelines", department: "water", priority: "high" },
      { code: "broken_public_water_taps", name: "Broken public water taps", department: "water" },
      { code: "blocked_drains", name: "Blocked drains", department: "drainage" },
      { code: "sewage_overflow", name: "Sewage overflow", department: "drainage", priority: "critical" },
      { code: "open_manholes", name: "Open manholes", department: "drainage", priority: "critical" },
      { code: "blocked_stormwater_drains", name: "Blocked stormwater drains", department: "drainage" },
      { code: "drainage_flooding", name: "Flooding caused by drainage problems", department: "drainage", priority: "high" },
      { code: "other_water_problems", name: "Other water-related problems", department: "water", priority: "low" }
    ]
  },
  {
    code: "garbage",
    name: "Garbage and Cleanliness",
    kind: "complaint",
    description: "Waste collection, street cleanliness, dustbins and sanitation.",
    subcategories: [
      { code: "missed_household_collection", name: "Missed household garbage collection", department: "sanitation" },
      { code: "garbage_dumping_public_places", name: "Garbage dumping in public places", department: "sanitation", priority: "high" },
      { code: "overflowing_dustbins", name: "Overflowing public dustbins", department: "sanitation" },
      { code: "dirty_streets", name: "Dirty streets", department: "sanitation" },
      { code: "dirty_public_spaces", name: "Dirty public spaces", department: "sanitation" },
      { code: "waste_segregation_problems", name: "Waste segregation problems", department: "sanitation" },
      { code: "recycling_issues", name: "Recycling-related issues", department: "sanitation", priority: "low" },
      { code: "dead_animal_removal", name: "Dead animal removal", department: "sanitation", priority: "high" },
      { code: "illegal_garbage_burning", name: "Illegal garbage burning", department: "environment", priority: "high" },
      { code: "missed_waste_collection", name: "Missed waste collection", department: "sanitation" },
      { code: "other_sanitation_problems", name: "Other sanitation problems", department: "sanitation", priority: "low" }
    ]
  },
  {
    code: "streetlights",
    name: "Streetlights and Public Electrical Infrastructure",
    kind: "complaint",
    description: "Street lighting, poles and exposed public electrical infrastructure.",
    subcategories: [
      { code: "non_working_streetlights", name: "Non-working streetlights", department: "electrical" },
      { code: "streetlights_daytime", name: "Streetlights switched on during daytime", department: "electrical", priority: "low" },
      { code: "damaged_light_poles", name: "Damaged light poles", department: "electrical", priority: "high" },
      { code: "exposed_electrical_wires", name: "Exposed electrical wires", department: "electrical", priority: "critical" },
      { code: "dark_public_areas", name: "Dark public areas", department: "electrical" },
      { code: "broken_park_lighting", name: "Broken park lighting", department: "electrical" },
      { code: "broken_market_lighting", name: "Broken market lighting", department: "electrical" },
      { code: "other_public_lighting", name: "Other public lighting problems", department: "electrical", priority: "low" }
    ]
  },
  {
    code: "public_health",
    name: "Public Health and Pest Control",
    kind: "complaint",
    description: "Vector control, fogging requests, public toilets and health hazards.",
    subcategories: [
      { code: "mosquito_breeding", name: "Mosquito breeding", department: "health", priority: "high" },
      { code: "stagnant_water", name: "Stagnant water", department: "health", priority: "high" },
      { code: "mosquito_fogging_request", name: "Mosquito fogging request", department: "health" },
      { code: "rodent_infestation", name: "Rodent infestation in public places", department: "health", priority: "high" },
      { code: "public_pest_infestation", name: "Public pest infestation", department: "health" },
      { code: "unhygienic_public_toilets", name: "Unhygienic public toilets", department: "health" },
      { code: "unsanitary_market_surroundings", name: "Unsanitary market surroundings", department: "markets" },
      { code: "public_health_hazards", name: "Public health hazards", department: "health", priority: "high" },
      { code: "other_public_health", name: "Other public health concerns", department: "health", priority: "low" }
    ]
  },
  {
    code: "parks",
    name: "Parks, Gardens and Public Spaces",
    kind: "complaint",
    description: "Gardens, playgrounds, walking tracks, benches, trees and public spaces.",
    subcategories: [
      { code: "unmaintained_gardens", name: "Unmaintained gardens", department: "parks" },
      { code: "damaged_playground_equipment", name: "Damaged playground equipment", department: "parks", priority: "high" },
      { code: "broken_benches", name: "Broken benches", department: "parks" },
      { code: "damaged_walking_tracks", name: "Damaged walking tracks", department: "parks" },
      { code: "dangerous_trees", name: "Dangerous trees", department: "parks", priority: "critical" },
      { code: "overgrown_branches", name: "Overgrown branches", department: "parks" },
      { code: "damaged_park_fencing", name: "Damaged park fencing", department: "parks" },
      { code: "damaged_park_lighting", name: "Damaged park lighting", department: "parks" },
      { code: "public_space_encroachment", name: "Public-space encroachment", department: "townplanning", priority: "high" },
      { code: "other_park_maintenance", name: "Other park maintenance problems", department: "parks", priority: "low" }
    ]
  },
  {
    code: "certificates",
    name: "Certificates and Citizen Documentation",
    kind: "service",
    description: "Information and documented submission workflows for municipal certificates. No certificate is issued by this portal.",
    subcategories: [
      {
        code: "birth_certificate", name: "Birth certificate information/application", department: "health", type: "application",
        summary: "Information about obtaining a birth certificate from the municipal registrar, and a documented submission workflow for supporting documents.",
        checklist: ["Proof of birth issued by the hospital or institution", "Identity proof of the parents", "Address proof", "Proof of the date and place of birth"],
        processing_time: "Statutory processing timelines are set by the municipal registrar and are not published by this portal."
      },
      {
        code: "death_certificate", name: "Death certificate information/application", department: "health", type: "application",
        summary: "Information about obtaining a death certificate from the municipal registrar, and a documented submission workflow for supporting documents.",
        checklist: ["Medical certificate of cause of death", "Identity proof of the deceased", "Identity proof of the applicant", "Address proof"],
        processing_time: "Statutory processing timelines are set by the municipal registrar and are not published by this portal."
      },
      {
        code: "birth_record_correction", name: "Birth record correction request", department: "health", type: "application",
        summary: "Documented submission workflow for requesting a correction to an existing birth record.",
        checklist: ["Existing birth certificate copy", "Documentary proof supporting the correction", "Identity proof of the applicant", "Affidavit where applicable"],
        processing_time: "Correction requests are reviewed by the municipal registrar."
      },
      {
        code: "death_record_correction", name: "Death record correction request", department: "health", type: "application",
        summary: "Documented submission workflow for requesting a correction to an existing death record.",
        checklist: ["Existing death certificate copy", "Documentary proof supporting the correction", "Identity proof of the applicant", "Affidavit where applicable"],
        processing_time: "Correction requests are reviewed by the municipal registrar."
      },
      {
        code: "marriage_registration_info", name: "Marriage registration information", department: "revenue", type: "information",
        summary: "Information about marriage registration with the municipal authority, including the required documents and where to apply.",
        checklist: ["Identity proof of both parties", "Age proof of both parties", "Address proof", "Passport-size photographs", "Witness identity proofs"],
        processing_time: "Registration appointments are scheduled by the municipal registrar."
      },
      {
        code: "property_certificates", name: "Property-related certificates", department: "revenue", type: "information",
        summary: "Information about property-related certificates issued by the municipal authority.",
        checklist: ["Property tax receipt", "Ownership documents", "Identity proof of the applicant"],
        processing_time: "Issued by the Revenue Department as per municipal procedure."
      },
      {
        code: "property_no_dues", name: "Property no-dues certificate", department: "revenue", type: "application",
        summary: "Documented submission workflow for requesting a property no-dues certificate. The certificate itself is issued by the Revenue Department after verification.",
        checklist: ["Property identification details", "Latest property tax payment receipts", "Identity proof of the applicant"],
        processing_time: "Issued by the Revenue Department after dues verification."
      },
      {
        code: "property_name_transfer_info", name: "Property name transfer information", department: "revenue", type: "information",
        summary: "Information about transferring the municipal record of a property to another name.",
        checklist: ["Ownership transfer documents", "Property tax receipts", "Identity proof of the applicant"],
        processing_time: "Processed by the Revenue Department as per municipal procedure."
      },
      {
        code: "property_mutation_info", name: "Property mutation information", department: "revenue", type: "information",
        summary: "Information about mutation of municipal property records.",
        checklist: ["Ownership documents", "Property tax receipts", "Identity proof of the applicant"],
        processing_time: "Processed by the Revenue Department as per municipal procedure."
      },
      {
        code: "plot_map_info", name: "Plot map information", department: "townplanning", type: "information",
        summary: "Information about obtaining a plot map or layout extract from the municipal authority.",
        checklist: ["Property identification details", "Ownership documents", "Identity proof of the applicant"],
        processing_time: "Issued by the Town Planning Department."
      },
      {
        code: "zone_certificate_info", name: "Zone certificate information", department: "townplanning", type: "information",
        summary: "Information about obtaining a zone certificate for a plot or property.",
        checklist: ["Property identification details", "Ownership documents", "Identity proof of the applicant"],
        processing_time: "Issued by the Town Planning Department."
      },
      {
        code: "other_documentation_services", name: "Other available municipal documentation services", department: "general", type: "information",
        summary: "Information about other municipal documentation services that are not listed above.",
        checklist: ["Identity proof of the applicant", "Documents specific to the service requested"],
        processing_time: "Depends on the service requested."
      }
    ]
  },
  {
    code: "property_tax",
    name: "Property Tax and Building Permissions",
    kind: "mixed",
    description: "Property tax issues, building permissions and unauthorised construction complaints.",
    subcategories: [
      { code: "property_tax_bill_errors", name: "Property tax bill errors", department: "revenue", type: "complaint" },
      { code: "property_tax_payment_issues", name: "Property tax payment issues", department: "revenue", type: "complaint" },
      { code: "property_assessment_disputes", name: "Property assessment disputes", department: "revenue", type: "complaint", priority: "high" },
      {
        code: "building_plan_approval_info", name: "Building plan approval information", department: "townplanning", type: "information",
        summary: "Information about the building plan approval process and the documents required for submission.",
        checklist: ["Ownership documents", "Approved layout or plot documents", "Architect-prepared building plans", "Identity proof of the applicant"],
        processing_time: "Statutory approval timelines are set by the Town Planning Department."
      },
      {
        code: "building_permission_tracking", name: "Building permission application tracking", department: "townplanning", type: "application",
        summary: "Documented submission workflow so that an application can be recorded and tracked. Approval decisions are taken by the Town Planning Department only.",
        checklist: ["Ownership documents", "Building plans", "Structural stability documents where applicable", "Identity proof of the applicant"],
        processing_time: "Decided by the Town Planning Department."
      },
      {
        code: "occupancy_certificate_info", name: "Occupancy certificate information", department: "townplanning", type: "information",
        summary: "Information about applying for an occupancy certificate.",
        checklist: ["Approved building plan", "Completion documents", "Identity proof of the applicant"],
        processing_time: "Issued by the Town Planning Department after inspection."
      },
      {
        code: "construction_completion_certificate_info", name: "Construction completion certificate information", department: "townplanning", type: "information",
        summary: "Information about the construction completion certificate process.",
        checklist: ["Approved building plan", "Completion documents", "Identity proof of the applicant"],
        processing_time: "Issued by the Town Planning Department after inspection."
      },
      { code: "unauthorized_construction_complaint", name: "Unauthorised construction complaint", department: "townplanning", type: "complaint", priority: "high" },
      { code: "illegal_building_extension_complaint", name: "Illegal building extension complaint", department: "townplanning", type: "complaint", priority: "high" },
      {
        code: "land_use_zoning_enquiry", name: "Land-use and zoning enquiry", department: "townplanning", type: "information",
        summary: "Information about land-use classification and zoning enquiries.",
        checklist: ["Property identification details", "Ownership documents"],
        processing_time: "Answered by the Town Planning Department."
      },
      { code: "other_property_issues", name: "Other property-related issues", department: "revenue", type: "complaint", priority: "low" }
    ]
  },
  {
    code: "fire_safety",
    name: "Fire Safety and Building Hazards",
    kind: "complaint",
    description: "Routine fire-safety reports and building hazards. Active fires are emergencies and must be reported to emergency services.",
    is_emergency: true,
    subcategories: [
      { code: "fire_safety_inspection_request", name: "Fire safety inspection request", department: "fire", type: "application" },
      { code: "fire_noc_info", name: "Fire NOC information", department: "fire", type: "information",
        summary: "Information about the Fire No-Objection Certificate process. The NOC is issued by the Fire and Emergency Safety Department only.",
        checklist: ["Building plans", "Fire safety equipment details", "Identity proof of the applicant"],
        processing_time: "Issued by the Fire and Emergency Safety Department after inspection."
      },
      { code: "blocked_emergency_access", name: "Blocked emergency access", department: "fire", type: "complaint", priority: "critical" },
      { code: "unsafe_building", name: "Unsafe building", department: "fire", type: "complaint", priority: "critical" },
      { code: "structural_damage", name: "Structural damage", department: "fire", type: "complaint", priority: "high" },
      { code: "fallen_trees", name: "Fallen trees", department: "parks", type: "complaint", priority: "high" },
      { code: "dangerous_public_infrastructure", name: "Dangerous public infrastructure", department: "general", type: "complaint", priority: "critical" },
      { code: "other_safety_hazards", name: "Other safety hazards", department: "fire", type: "complaint" }
    ]
  },
  {
    code: "animal_welfare",
    name: "Animal Welfare and Control",
    kind: "complaint",
    description: "Stray animal control, vaccination, sterilisation and animal-related concerns.",
    subcategories: [
      { code: "stray_dog_sterilization_request", name: "Stray dog sterilisation request", department: "animal", type: "application" },
      { code: "stray_dog_vaccination_request", name: "Stray dog vaccination request", department: "animal", type: "application" },
      { code: "aggressive_stray_animal", name: "Aggressive stray animal report", department: "animal", type: "complaint", priority: "high" },
      { code: "injured_animal", name: "Injured animal report", department: "animal", type: "complaint", priority: "high" },
      { code: "stray_cattle_on_roads", name: "Stray cattle on roads", department: "animal", type: "complaint", priority: "high" },
      { code: "animal_carcass_removal", name: "Animal carcass removal", department: "animal", type: "complaint", priority: "high" },
      { code: "animal_public_nuisance", name: "Public nuisance caused by animals", department: "animal", type: "complaint" },
      { code: "other_animal_concerns", name: "Other animal-related concerns", department: "animal", type: "complaint", priority: "low" }
    ]
  },
  {
    code: "education_welfare",
    name: "Education and Community Welfare",
    kind: "service",
    description: "Municipal schools, community halls, libraries, sports facilities and welfare schemes.",
    subcategories: [
      { code: "school_maintenance", name: "Municipal school maintenance complaints", department: "education", type: "complaint" },
      { code: "school_sanitation", name: "School sanitation complaints", department: "education", type: "complaint", priority: "high" },
      { code: "school_drinking_water", name: "School drinking water problems", department: "education", type: "complaint", priority: "high" },
      { code: "community_hall_booking_info", name: "Community hall booking information", department: "general", type: "information",
        summary: "Information about booking a municipal community hall, including the enquiry process.",
        checklist: ["Identity proof of the applicant", "Purpose and date of the event", "Applicable municipal charges as notified"],
        processing_time: "Confirmed by the municipal office after availability is verified." },
      { code: "public_library_info", name: "Public library information", department: "education", type: "information",
        summary: "Information about municipal public libraries, membership and timings.",
        checklist: ["Identity proof", "Address proof"],
        processing_time: "Membership is issued at the library counter." },
      { code: "public_sports_facility_info", name: "Public sports facility information", department: "education", type: "information",
        summary: "Information about municipal sports grounds and facilities.",
        checklist: ["Identity proof of the applicant"],
        processing_time: "Confirmed by the municipal office after availability is verified." },
      { code: "senior_citizen_welfare_info", name: "Senior citizen welfare information", department: "education", type: "information",
        summary: "Information about municipal welfare measures available to senior citizens.",
        checklist: ["Identity proof", "Age proof", "Address proof"],
        processing_time: "Depends on the scheme." },
      { code: "housing_scheme_info", name: "Eligible housing scheme information", department: "education", type: "information",
        summary: "Information about housing schemes for which residents may be eligible. Eligibility is determined by the implementing authority only.",
        checklist: ["Identity proof", "Address proof", "Income proof where applicable"],
        processing_time: "Determined by the implementing authority." },
      { code: "livelihood_scheme_info", name: "Livelihood scheme information", department: "education", type: "information",
        summary: "Information about municipal livelihood and self-employment schemes.",
        checklist: ["Identity proof", "Address proof", "Scheme-specific documents"],
        processing_time: "Determined by the implementing authority." },
      { code: "other_welfare_services", name: "Other available municipal welfare services", department: "general", type: "information",
        summary: "Information about other municipal welfare services not listed above.",
        checklist: ["Identity proof of the applicant"],
        processing_time: "Depends on the service requested." }
    ]
  },
  {
    code: "markets_facilities",
    name: "Markets and Public Facilities",
    kind: "complaint",
    description: "Municipal markets, public toilets, bus shelters, benches, hoardings and public facilities.",
    subcategories: [
      { code: "market_maintenance", name: "Municipal market maintenance", department: "markets" },
      { code: "public_toilet_maintenance", name: "Public toilet maintenance", department: "markets", priority: "high" },
      { code: "damaged_bus_shelters", name: "Damaged bus shelters", department: "markets" },
      { code: "broken_public_benches", name: "Broken public benches", department: "markets" },
      { code: "illegal_hoardings", name: "Illegal hoardings", department: "markets" },
      { code: "unauthorized_encroachment", name: "Unauthorised encroachment", department: "townplanning", priority: "high" },
      { code: "public_parking_complaints", name: "Public parking complaints", department: "markets" },
      { code: "municipal_building_maintenance", name: "Municipal building maintenance", department: "markets" },
      { code: "other_public_facility_issues", name: "Other public facility issues", department: "markets", priority: "low" }
    ]
  },
  {
    code: "environment",
    name: "Environmental Issues",
    kind: "complaint",
    description: "Pollution, waste burning, tree hazards and environmental nuisance.",
    subcategories: [
      { code: "illegal_waste_burning", name: "Illegal waste burning", department: "environment", priority: "high" },
      { code: "public_space_pollution", name: "Public-space pollution", department: "environment" },
      { code: "tree_related_hazards", name: "Tree-related hazards", department: "environment", priority: "high" },
      { code: "environmental_nuisance", name: "Environmental nuisance", department: "environment" },
      { code: "improper_waste_disposal", name: "Improper waste disposal", department: "environment" },
      { code: "waterlogging_environmental", name: "Waterlogging-related environmental concerns", department: "environment", priority: "high" },
      { code: "other_environmental_issues", name: "Other environmental issues", department: "environment", priority: "low" }
    ]
  },
  {
    code: "other",
    name: "Other Civic Issues",
    kind: "complaint",
    description: "Civic issues that do not fall into any of the categories above.",
    subcategories: [
      { code: "general_civic_issue", name: "General civic issue", department: "general", priority: "low" },
      { code: "other_civic_problem", name: "Other civic problem not listed", department: "general", priority: "low" }
    ]
  }
];

module.exports = { DEPARTMENTS, WARDS, SLA_DEFAULTS, CATEGORIES };
