import java.util.Scanner;
class Pi{
    public static void main(String[] args) 
    {
        Scanner scan=new Scanner(System.in);
        // int n=scan.nextInt();
        double exp=scan.nextDouble();
        int i=1;
        double sum=0,cnt=4.0/(2*i-1),f=1;
        while((cnt>0?cnt:-cnt)>exp)
        {
            sum+=cnt;
            i++;
            f=-f;
            cnt=f*4.0/(2*i-1);
            System.out.printf("%d %.9f\n",i,sum);
        }
        System.out.printf("%.9f\n",sum);
        scan.close();
    }
}