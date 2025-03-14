import java.util.*;
public class Array {
    public static void main(String[] args) {
        int[] arr = {1,2,3,4,5};
        int[] arr2 = new int[5];
        int[] arr3 = new int[5];
        arr2=arr;
        arr3=Arrays.copyOf(arr,5);
        arr[3]=9;
        System.out.println(Arrays.toString(arr));
        System.out.println(Arrays.toString(arr2));
        System.out.println(Arrays.toString(arr3));
        int[][] arr4={{1,2,3},{4,5,6},{7,8,9}};;
        int[][] arr5=new int[3][3];
        int[][] arr6=new int[3][3];
        arr5=arr4;
        arr6=Arrays.copyOf(arr4,3);//shallow copy
        arr4[1][1]=9;
        System.out.println(Arrays.deepToString(arr4));
        System.out.println(Arrays.deepToString(arr5));
        System.out.println(Arrays.deepToString(arr6));
    }
}
