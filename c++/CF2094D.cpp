#include<bits\stdc++.h>//TODO need try
using namespace std;
const int N=2e5+10;

int l[N],top=0;
void mian()
{   
    top=0;
    memset(l,0,sizeof(l));
    char s1[N],s2[N];
    scanf("%s",s1);
    scanf("%s",s2);
    int l1=strlen(s1),l2=strlen(s2);
    if(l2<l1) 
    {
        puts("NO");
        return ;
    }
    int i=0,j=0,tp=0;
    for(;i<l1;i++)
    {
        if(s1[i]!=s1[j])
        {
            top++;
            l[top]=i-j;
            j=i;
        }
    }
    top++;
    l[top]=l1-j;

    // for(int i=1;i<=top;i++)
    // {
    //     printf("%d ",l[i]);
    // }

    i=0,j=0,tp=0;
    for(;i<l2;i++)
    {   
        if(s2[i]!=s2[j])
        {
            tp++;
            if(i-j<l[tp]||i-j>2*l[tp])
            {
                puts("NO");
                return ;
            }
            j=i;
        }
        if(tp>top)
        {
            puts("NO");
            return ;
        }
    }
    tp++;
    if(l2-j<l[tp]||l2-j>2*l[tp])
    {
        puts("NO");
        return ;
    }
    if(tp<top)
    {
        puts("NO");
        return ;
    }


    puts("YES");
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