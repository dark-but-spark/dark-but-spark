#include <stdio.h>
#include <math.h>

int main() 
{
    int num, originalNum, sum = 0, digit;

    printf("Enter a 3-digit integer: ");
    scanf("%d", &num);

    if (num < 100 || num > 999) 
    {
        printf("Error: The number is not a 3-digit integer.\n");
        return 0;
    }

    originalNum = num;
    while (num != 0) 
    {
        digit = num % 10;
        sum += pow(digit, 3);
        num /= 10;
    }

    if (sum == originalNum) 
    {
        printf("It is a daffodil number.\n");
    } 
    else 
    {
        printf("It is not a daffodil number.\n");
    }

    return 0;
}