#include<bits\stdc++.h>
using namespace std;
const int N=1e5+10;

int main()
{
    int n;
    char s[N];
    cin.getline(s, N);
    for(int i=0;i<strlen(s);i++)
    {
        n=n*10+s[i]-'0';
    }
    for(int i=0;i<n;i++)
    {
        cin.getline(s, N);
        // printf("%d\n",i);
        // printf("%s\n",s);
        for(int j=0;j<strlen(s);j++)
        {
            if(s[j]==' ')
            {
                printf("%c",s[j+1]);
            }
            if(j==0)
            {
                printf("%c",s[j]);
            }
        }
        printf("\n");
    }
    return 0;
}