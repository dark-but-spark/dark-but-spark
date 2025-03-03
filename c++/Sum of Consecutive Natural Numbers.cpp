
#include <bits/stdc++.h>
using namespace std;

int main()
{

    int n;
    cin >> n;
    vector<pair<int,int>> ans;
    ans.clear();
    int l=1,r=1,sum=1;
    while(l<n)
    {
        while(sum+r<=n)
        {
            r++;
            sum+=r;
        }
        if(sum==n)
        {
            ans.push_back(make_pair(l,r));
        }
        sum-=l;
        l++;

    }
    cout<<ans.size()<<endl;
    for(int i=ans.size()-1;i>=0;i--)
    {
        for(int j=ans[i].first;j<=ans[i].second;j++)
        {
            cout<<j<<" ";
        }
        cout<<endl;
    }
    
    return 0;
}

/*
http://www.zjutacm.cn/contest/84/problem/C
连续自然数的和 / Sum of Consecutive Natural Numbers
Description

连续自然数的加法是我们小学二年级就学过的内容，例如
1
+
2
+
3
=
6
,
10
+
11
+
12
=
33
1+2+3=6,10+11+12=33。现在小苏希望知道一个自然数
N
N可以分解为多少种连续自然数的和。

注意连续自然数的和指的是最少为2个连续自然数的和，且在本题中不考虑自然数0。

The addition of consecutive natural numbers is something we learned in the second grade, for example, 
1
+
2
+
3
=
6
1+2+3=6 and 
10
+
11
+
12
=
33
10+11+12=33. Now Xiao Su wants to know how many ways a natural number 
N
N can be expressed as the sum of consecutive natural numbers.

Note that the sum of consecutive natural numbers refers to the sum of at least two consecutive numbers, and in this problem, we do not consider the natural number 
0
0.


Input

输入为一个数
N
N

The input consists of a single integer 
N
N.


Output

第1行输出可以分解的种数
K
K

然后第2行到第
K
+
1
K+1行列出方案
l
 
l
+
1
…
r
l l+1…r，使得
l
+
⋯
+
r
=
N
l+⋯+r=N

注意按照
l
l的从大到小的顺序输出

The first line should output the number of ways 
K
K that 
N
N can be expressed as the sum of consecutive natural numbers.

The next 
K
K lines should each list a valid sequence of consecutive numbers of the form 
l
,
l
+
1
,
…
,
r
l,l+1,…,r, where 
l
+
⋯
+
r
=
N
l+⋯+r=N.

Please note that the sequences should be output in descending order of 
l
l.


Sample Input 1 

55
Sample Output 1

3
27 28
9 10 11 12 13
1 2 3 4 5 6 7 8 9 10
Sample Input 2 

8
Sample Output 2

0
Hint

对于所有数据
1
≤
N
≤
1
0
9
1≤N≤10 
9
 

For all test cases 
1
≤
N
≤
1
0
9
1≤N≤10 

*/