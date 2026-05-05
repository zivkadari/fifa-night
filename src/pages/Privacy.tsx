import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  const navigate = useNavigate();

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft className="h-5 w-5 rotate-180" />
        </Button>
        <h1 className="text-2xl font-bold">מדיניות פרטיות – Soccer Night</h1>
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        עדכון אחרון: מאי 2026 · מסמך זה הוא מידע כללי בלבד ואינו מהווה ייעוץ משפטי.
      </p>

      <Section title="איזה מידע אנחנו שומרים">
        <p>כאשר אתה משתמש ב-Soccer Night, אנו שומרים את המידע הבא:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>שם וכתובת אימייל מחשבון Google (לצורך זיהוי והתחברות)</li>
          <li>שמות שחקנים, קבוצות ותוצאות טורנירים שהזנת</li>
          <li>הגדרות והעדפות שבחרת באפליקציה</li>
        </ul>
      </Section>

      <Section title="איך אנחנו משתמשים במידע">
        <p>המידע שנאסף משמש אך ורק להפעלת האפליקציה: הצגת הנתונים שלך, ניהול טורנירים, שמירת היסטוריה וסטטיסטיקות. איננו מוכרים, משתפים או מעבירים מידע אישי לצדדים שלישיים.</p>
      </Section>

      <Section title="התחברות עם Google">
        <p>Soccer Night משתמשת בהתחברות Google אך ורק לצורך אימות וזיהוי המשתמש. ההתחברות אינה מעניקה ל-Soccer Night גישה ל-Gmail, Google Drive, או כל תוכן אחר בחשבון Google שלך.</p>
      </Section>

      <Section title="מי יכול לראות את המידע">
        <p>נתוני טורנירים ותוצאות עשויים להיות גלויים לחברי הקבוצה שלך או למשתמשים שקיבלו קישור צפייה. מידע אישי כמו כתובת אימייל אינו מוצג למשתמשים אחרים.</p>
      </Section>

      <Section title="שמירת מידע ומחיקתו">
        <p>המידע שלך נשמר כל עוד חשבונך פעיל. ניתן לפנות אלינו בכתובת <a href="mailto:zivkad12@gmail.com" className="text-primary underline">zivkad12@gmail.com</a> לבקשת מחיקת נתונים.</p>
      </Section>

      <Section title="אבטחת מידע">
        <p>אנו משתמשים בשירותי ענן מאובטחים (Supabase) לאחסון הנתונים. עם זאת, אין מערכת מאובטחת ב-100% ואיננו יכולים להבטיח אבטחה מוחלטת.</p>
      </Section>

      <Section title="פרטיות ילדים ומשתמשים צעירים">
        <p>Soccer Night אינה מיועדת לילדים מתחת לגיל 13. איננו אוספים ביודעין מידע מילדים. אם נודע לנו שנאסף מידע כזה, נמחק אותו.</p>
      </Section>

      <Section title="יצירת קשר">
        <p>לשאלות או בקשות בנוגע לפרטיות, ניתן לפנות אלינו בכתובת: <a href="mailto:zivkad12@gmail.com" className="text-primary underline">zivkad12@gmail.com</a></p>
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-6">
    <h2 className="text-lg font-semibold mb-2 text-primary">{title}</h2>
    <div className="text-muted-foreground text-sm leading-relaxed">{children}</div>
  </div>
);

export default Privacy;
