import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">תנאי שימוש – Soccer Night</h1>
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        עדכון אחרון: מאי 2026 · מסמך זה הוא מידע כללי בלבד ואינו מהווה ייעוץ משפטי.
      </p>

      <Section title="מהי Soccer Night">
        <p>Soccer Night היא אפליקציית ווב לניהול טורנירי כדורגל וירטואליים בין חברים. האפליקציה מאפשרת ניהול שחקנים, קבוצות, הקצאת מועדונים וליגות, ומעקב אחר תוצאות.</p>
      </Section>

      <Section title="שימוש מותר באפליקציה">
        <p>השימוש באפליקציה מיועד למטרות פנאי ובידור בלבד. אין להשתמש באפליקציה למטרות מסחריות, הימורים, או כל פעילות בלתי חוקית.</p>
      </Section>

      <Section title="חשבונות משתמשים">
        <p>ניתן להתחבר לאפליקציה באמצעות חשבון Google. המשתמש אחראי לשמירה על אבטחת חשבונו. אנו שומרים את הזכות לחסום חשבונות שמפרים את תנאי השימוש.</p>
      </Section>

      <Section title="קבוצות, שחקנים וטורנירים">
        <p>המשתמשים יכולים ליצור קבוצות, להוסיף שחקנים, ולנהל טורנירים. כל התוכן שנוצר על ידי המשתמשים הוא באחריותם הבלעדית.</p>
      </Section>

      <Section title="תוכן שהמשתמשים מזינים">
        <p>המשתמשים אחראים לתוכן שהם מזינים באפליקציה, כולל שמות שחקנים, שמות קבוצות ותוצאות. אין להזין תוכן פוגעני, מטעה או בלתי חוקי.</p>
      </Section>

      <Section title="זמינות השירות">
        <p>אנו משתדלים לספק שירות רציף וזמין, אך איננו מתחייבים לזמינות 100%. השירות עשוי להיות מושבת לצורך תחזוקה או שדרוגים ללא הודעה מוקדמת.</p>
      </Section>

      <Section title="הגבלת אחריות">
        <p>Soccer Night מסופקת "כמות שהיא" (as is) ללא אחריות מכל סוג. איננו אחראים לאובדן נתונים, תקלות, או כל נזק הנובע משימוש באפליקציה.</p>
      </Section>

      <Section title="שימוש הוגן וסימני מסחר">
        <p>Soccer Night היא אפליקציה עצמאית לניהול טורנירים ואינה קשורה, ממומנת, מאושרת או מופעלת על ידי FIFA, EA Sports, Electronic Arts או כל מפיצת משחקים אחרת. כל שמות המותגים וסימני המסחר שייכים לבעליהם.</p>
      </Section>

      <Section title="יצירת קשר">
        <p>לשאלות או בקשות בנוגע לתנאי השימוש, ניתן לפנות אלינו בכתובת: <a href="mailto:zivkad12@gmail.com" className="text-primary underline">zivkad12@gmail.com</a></p>
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

export default Terms;
