// Haverford College majors, used to build the major filter.
const MAJORS = [
  "Anthropology",
  "Astronomy",
  "Astrophysics",
  "Biology",
  "Chemistry",
  "Classical Culture and Society",
  "Classical Languages",
  "Comparative Literature",
  "Computer Science",
  "East Asian Languages and Cultures",
  "Economics",
  "English",
  "Environmental Studies",
  "Fine Arts",
  "French and Francophone Studies",
  "German",
  "Greek / Latin (Classical Studies)",
  "History",
  "Italian",
  "Linguistics",
  "Mathematics and Statistics",
  "Music",
  "Neuroscience (Bi-College Major)",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Religion",
  "Russian",
  "Sociology",
  "Spanish",
];

const TYPES = ["Internship", "Research", "Fellowship", "Funding", "Job", "Summer Education Program", "Event", "Scholarship", "Club", "Volunteer", "Career Prep", "Graduate Program"];

const CLASS_YEARS = ["First-year", "Sophomore", "Junior", "Senior"];

// Interests students can pick in My Profile. A listing matches an interest when
// its title, organization, type or description mentions one of the keywords.
const INTERESTS = {
  "Finance & Investing": ["finance", "financial analyst", "financial analysis", "financial modeling", "financial services", "banking", "investment", "investing", "wall street", "private equity", "trading", "hedge fund", "asset management", "actuarial", "quant"],
  "Consulting & Business": ["consulting", "consultant", "business", "strategy", "case interview", "entrepreneur", "entrepreneurship", "marketing", "startup"],
  "Tech & Data": ["tech", "technology", "data", "computer science", "software", "coding", "AI", "A.I.", "machine learning", "hackathon", "robotics", "quantum", "engineering"],
  "Law & Policy": ["law", "legal", "policy", "government", "political", "federal", "mock trial", "public service"],
  "Health & Medicine": ["health", "medical", "medicine", "pre-med", "clinical", "translational", "bioethics", "healthcare", "neuroscience"],
  "Research & Science": ["research", "science", "scientific", "lab", "STEM", "chemistry", "biology", "physics"],
  "Education & Teaching": ["education", "teaching", "teacher", "tutor", "tutoring", "mentor", "mentorship", "classroom"],
  "Arts, Media & Journalism": ["art", "fine arts", "visual arts", "performing arts", "museum", "journalism", "journalist", "media", "writing", "film", "music", "design", "editor", "publishing", "magazine", "news"],
  "Environment & Sustainability": ["environment", "environmental", "sustainability", "sustainable", "climate", "conservation", "energy", "green jobs"],
  "Nonprofit & Social Impact": ["nonprofit", "non-profit", "social impact", "community", "volunteer", "diversity", "equity", "advocacy"],
  "International & Global": ["international", "global", "abroad", "visa", "latin american", "china", "intercultural"],
  "Graduate School": ["graduate school", "graduate program", "master's", "masters", "law school", "Ph.D.", "PhD", "MBA", "admissions"],
};
