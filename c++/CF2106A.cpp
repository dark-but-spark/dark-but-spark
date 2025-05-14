#include<bits/stdc++.h>
#define ll long long
using namespace std;
const int N=2e5+10;
int n;
char s[N];

void mian() 
{
    scanf("%d",&n);
    scanf("%s",s+1);
    ll ans=0;
    for(int i=1;i<=n;i++)
    {
        if(s[i]=='1')
        {
            ans+=n-1;
        }
        else
        {
            ans+=1;
        }
    }
    printf("%lld\n", ans);
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
