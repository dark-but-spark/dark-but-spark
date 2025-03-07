import java.util.Scanner;
// 99 multiplication table
class mul99{
    public static void print(int x)
    {
        for (int i = 1; i <= x; i++) {
            for (int j = 1; j<=i;j++) {
                System.out.printf("%d * %d = %2d\t", i,j,i*j);
            }
            System.out.printf("\n");
        }
    }
    public static void main(String[] args) 
    {
        Scanner in = new Scanner(System.in);
        do {
            System.out.println("Please input a number between [1,9]:");
            int number = in.nextInt();
            if (number>0 && number<10) {
                System.out.printf("number %d is in [1, 9]\n", number);
                print(number);
            } else if (number==0) {
                break;
            }else{
                System.out.println("Your number is not in [1,9]");
            }      
        } while (true);
    }
}