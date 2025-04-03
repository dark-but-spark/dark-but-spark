import java.io.StringReader;
import java.util.Scanner;
class ScanString
{
    public static void main(String[] args)
    {
        String str="1 2 3\n4 5 6\n7 8 9\n hello world";
        StringReader sr=new StringReader(str);
        Scanner sc=new Scanner(sr);
        while(sc.hasNextLine())
        {
            String line=sc.nextLine();
            System.out.println(line);
            Scanner sc2=new Scanner(line);
            while(sc2.hasNext())
            {
                if(sc2.hasNextInt())
                {
                    System.out.print(sc2.nextInt()+",");
                }
                else
                {
                    System.out.print(sc2.next()+",");
                }
            }
            System.out.println();
            sc2.close();
        }
        sc.close();

    }
}