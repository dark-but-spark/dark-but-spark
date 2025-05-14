#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n,x;
void mian() 
{
    scanf("%d",&n);
    scanf("%d",&x);
    for(int i=0;i<x;i++)
    {
        printf("%d ",i);
    }
    for(int i=n-1;i>=x;i--)
    {
        printf("%d ",i);
    }
    printf("\n");
    return;

}


int main()
{
    int t;
    scanf("%d",&t);
    while(t--)
    {
        mian();
    }
    return 0;
}
